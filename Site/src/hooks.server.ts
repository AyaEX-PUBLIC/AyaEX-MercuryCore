// "'Hooks' are app-wide functions you declare that SvelteKit will call in response to specific events, giving you fine-grained control over the framework's behaviour."
// See https://kit.svelte.dev/docs/hooks/ for more info.

import {
	type Handle,
	type HandleServerError,
	type RequestEvent,
	error,
	redirect,
} from "@sveltejs/kit"
import { dev } from "$app/environment"
import pc from "picocolors"
import {
	cookieName,
	cookieOptions,
	validateSessionToken,
} from "$lib/server/auth"
import { readBody, rejectDeclaredBodyOver } from "$lib/server/body"
import {
	clientChannelCookie,
	defaultClientChannel,
} from "$lib/clientChannels"
import config from "$lib/server/config"
import { stipend } from "$lib/server/economy"
import {
	bodyLimitFor,
	isUploadPath,
	streamsItself,
	uploadOnly,
} from "$lib/server/requestLimits"
import { startStreamingRelay } from "$lib/server/streaming"
import { db, Record } from "$lib/server/surreal"
import moderatedQuery from "./moderated.surql"

const { magenta, red, yellow, green, blue, gray } = pc
const methodColours = Object.freeze({
	GET: green("GET"),
	POST: yellow("POST"),
})
const pathnameColours = Object.freeze({
	api: green,
	download: yellow,
	moderation: yellow,
	report: yellow,
	statistics: yellow,
	register: blue,
	login: blue,
	place: magenta,
	admin: red,
})

function pathnameColour(pathname: string) {
	for (const [prefix, colour] of Object.entries(pathnameColours))
		if (pathname.startsWith(`/${prefix}`)) return colour(pathname)

	return pathname
}

const time = () =>
	config.Logging.Time ? gray(new Date().toLocaleString()) : ""

const userLog = (user: User | null) =>
	user
		? blue(user.username) + " ".repeat(21 - user.username.length)
		: yellow("Logged-out user      ")

// tickets, file tokens and keys travel in query strings; the console and any
// log kept from it shouldn't hold them
const redact = (search: string) =>
	search.replace(
		/([?&](?:ticket|token|accesskey|access_key|key|code|auth)=)[^&]*/gi,
		"$1…"
	)

/** Sets a response header, copying the response if its headers are read-only */
function setHeader(res: Response, name: string, value: string) {
	try {
		res.headers.set(name, value)
		return res
	} catch {
		// headers of a fetched response can't be changed
		const copy = new Response(res.body, res)
		copy.headers.set(name, value)
		return copy
	}
}

async function finish({ event, resolve }: Parameters<Handle>[0]) {
	const { pathname, search } = event.url
	const { user } = event.locals

	if (config.Logging.Requests) {
		// Fancy logging: time(?), user, method, and path
		const method = event.request.method as keyof typeof methodColours
		console.log(
			time(),
			userLog(user),
			methodColours[method] || method,
			" ".repeat(7 - method.length),
			pathnameColour(decodeURI(pathname) + redact(search))
		)
	}

	let res = await resolve(event)

	// the Site's pages may be framed by the Site itself and by nobody else, so
	// another site can't overlay them to trick a click (clickjacking)
	if (!res.headers.has("x-frame-options"))
		res = setHeader(res, "x-frame-options", "SAMEORIGIN")
	const csp = res.headers.get("content-security-policy")
	if (!csp?.includes("frame-ancestors"))
		res = setHeader(
			res,
			"content-security-policy",
			csp ? `${csp}; frame-ancestors 'self'` : "frame-ancestors 'self'"
		)

	// a signed-in user's pages (or anything renewing the session cookie) are
	// theirs alone, so a cache in front of the site must never keep them
	if (user || res.headers.has("set-cookie")) {
		const cc = res.headers.get("cache-control")
		const add = ["private", "no-store"].filter(d => !cc?.includes(d))
		if (add.length) {
			const value = [cc, ...add].filter(Boolean).join(", ")
			try {
				res.headers.set("cache-control", value)
			} catch {
				// headers of a fetched response can't be changed
				res = new Response(res.body, res)
				res.headers.set("cache-control", value)
			}
		}
	}

	if (!res.headers.get("content-type")?.includes("text/html")) return res

	// if it's html, add the user's theme and custom CSS before the </body> tag
	const file = Bun.file(`../Assets/${config.Themes[user?.theme || 0].Path}`)
	const themecss = await file.text()
	const customcss = user?.css
		? `<style id="custom-css">${user.css}</style>`
		: ""

	// duplicate the response to avoid modifying the original
	const text = (await res.clone().text()).replace(
		"</body>",
		`<style>${themecss}</style>${customcss}</body>`
	)

	res.headers.delete("content-length") // prevent cutoff, since the body was modified

	return new Response(text, {
		status: res.status,
		statusText: res.statusText,
		headers: res.headers,
	})
}

// Ran once when the server starts
export function init() {
	// the upload-only instance shares the Site image but must not try to bind
	// the StreamingFrame relay's port a second time
	if (!uploadOnly) startStreamingRelay()
}

// (main) pages need a signed-in user. Their layout load redirects, but
// SvelteKit skips layout loads for __data.json requests that don't ask for
// them, so data requests are refused here too (each page's load also checks).
const signedOutData = (event: RequestEvent) =>
	event.isDataRequest && !!event.route.id?.startsWith("/(main)")

/**
 * Enforces the route's body limit before a handler parses anything. Small
 * multipart forms are read here once, under the limit, so `formData()` can
 * never buffer more than the route allows. The two place uploads stream to
 * disk themselves, so this only rejects their declared length early.
 */
const maxBufferedUploads = 4
let bufferedUploads = 0

async function limitRequestBody(event: RequestEvent) {
	const { pathname } = event.url
	if (uploadOnly && !isUploadPath(pathname))
		error(404, "This instance only accepts uploads")

	const limit = bodyLimitFor(pathname)
	rejectDeclaredBodyOver(event.request, limit)

	if (!isUploadPath(pathname) || streamsItself(pathname)) return
	if (!event.request.body) return

	// Bound how many of the large (but not disk-streamed) forms can be in
	// memory at once; 4 x 21MB is the worst case.
	if (bufferedUploads >= maxBufferedUploads)
		error(503, "Too many uploads, try again shortly")
	bufferedUploads++
	try {
		const body = await readBody(event.request, limit)
		const headers = new Headers(event.request.headers)
		headers.delete("transfer-encoding")
		headers.set("content-length", String(body.byteLength))
		event.request = new Request(event.request, { body, headers })
	} finally {
		bufferedUploads--
	}
}

// Ran every time a dynamic request is made.
// Requests for prerendered pages do not trigger this hook.
export async function handle(e: Parameters<Handle>[0]) {
	const { event } = e
	await limitRequestBody(event)

	const token = event.cookies.get(cookieName)
	if (!token) {
		event.locals.session = null
		event.locals.user = null
		event.cookies.delete(cookieName, { path: "/" })
		if (signedOutData(event)) redirect(302, "/login")

		return await finish(e)
	}

	const { session, user } = await validateSessionToken(token)
	if (!session || !user) {
		event.locals.session = null
		event.locals.user = null
		if (signedOutData(event)) redirect(302, "/login")
		return await finish(e)
	}

	event.locals.session = session
	event.locals.user = user
	event.cookies.set(cookieName, session, cookieOptions)

	// Caddy picks the /runtime directory from this cookie, so keep it in step
	// with the account setting (a new device, or a change made elsewhere)
	const channel = user.clientChannel || defaultClientChannel
	if (event.cookies.get(clientChannelCookie) !== channel)
		event.cookies.set(clientChannelCookie, channel, {
			secure: !dev,
			httpOnly: true,
			sameSite: "lax",
			maxAge: 365 * 24 * 60 * 60,
			path: "/",
		})

	const [, moderated] = await db.query<boolean[][]>(moderatedQuery, {
		user: Record("user", user.id),
	})

	const { pathname } = event.url
	if (
		moderated &&
		!["/moderation", "/api"].includes(pathname) &&
		!pathname.startsWith("/api/avatar")
	)
		redirect(302, "/moderation")

	// Accounts without a recovery phrase must make one (/migrate) before
	// anything else, including playing. Signing out (/api) and the phrase
	// API still work; APIs, remote functions and the Switch get an error.
	if (
		!user.hasPhrase &&
		!pathname.startsWith("/migrate") &&
		!["/api", "/api/auth", "/moderation"].includes(pathname) &&
		!pathname.startsWith("/api/avatar") &&
		!pathname.startsWith("/assets/") // the site's logo and icon
	) {
		if (pathname.startsWith("/api") || pathname.startsWith("/_app"))
			return Response.json(
				{ message: "Make your recovery phrase first, at /migrate" },
				{ status: 403 }
			)
		redirect(302, "/migrate")
	}

	await stipend(e.event.fetch, user.id)

	return await finish(e)
}

export async function handleError({
	error,
}: Parameters<HandleServerError>[0]) {
	if (typeof error === "object" && error != null) {
		const status = (error as { status?: number }).status
		if (status) {
			console.error(status, red(error.toString()))
			return
		}
	}

	// Simple error logging (not a stack trace)
	if (!config.Logging.FormattedErrors) console.error(error)
	else console.error(red(error as string))
}
