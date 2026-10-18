import { error, json } from "@sveltejs/kit"
import sharp from "sharp"
import config from "$lib/server/config"
import { cookieName, cookieOptions, createSession, invalidateSession } from "$lib/server/auth"
import { db, Record, type RecordId } from "$lib/server/surreal"
import { engineUserId } from "$lib/server/engineUser"
import { siteOrigin } from "$lib/server/origin"
import { deviceCodeLifetime, pollDevice, startDevice } from "$lib/server/deviceCode"
import { actions } from "../../(main)/place/[id=asset]/[name]/+page.server"
import { GET as ayaJoin } from "../../(rbxclient)/game/join/aya/+server"
import { GET as avatarImage } from "../avatar/[username]/+server"
import gamesQuery from "./games.surql"
import searchPlaces from "./searchPlaces.surql"
import searchUsers from "../../(main)/search/searchUsers.surql"
import placeQuery from "../../(main)/place/[id=asset]/[name]/place.surql"
import type { RequestHandler } from "./$types"

// Native clients use the same expiring sessions, privacy checks and join
// tickets as the website. Never ship an asset access key to the console.
const thumbnails = new Map<number, { image: string; until: number }>()
async function thumbnail(id: number) {
	const cached = thumbnails.get(id)
	if (cached && cached.until > Date.now()) return cached.image
	const custom = Bun.file(`../data/placethumbnails/${id}.avif`)
	const defaults = config.Images.DefaultPlaceThumbnails
	const file = await custom.exists() ? custom : Bun.file(`../Assets/${defaults[id % defaults.length]}`)
	try {
		const image = (await sharp(Buffer.from(await file.arrayBuffer())).resize(640, 296, { fit: "cover" }).png().toBuffer()).toString("base64")
		if (thumbnails.size >= 64) thumbnails.delete(thumbnails.keys().next().value!)
		thumbnails.set(id, { image, until: Date.now() + 60_000 })
		return image
	} catch { return "" }
}
function profile(user: { username: string; status?: string }) {
	return { username: user.username, displayName: user.username,
		userId: engineUserId(user.username), status: user.status || "" }
}
function loggedIn(locals: App.Locals) {
	if (!locals.user || !locals.session) error(401, "Please sign in to Mercury.")
	return locals.user
}
function placeId(value: unknown) {
	const id = Number(value)
	if (!Number.isSafeInteger(id) || id <= 0) error(400, "Invalid place")
	return id
}
const reply = (data: unknown) => json(data, { headers: { "Cache-Control": "no-store" } })

export const GET: RequestHandler = async (event) => {
	const { locals, url } = event
	const user = loggedIn(locals)
	const op = url.searchParams.get("op") || "me"
	if (op === "me") return reply(profile(user))
	if (op === "games") {
		const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1))
		const [games, pages] = await db.query<[{ id: number; name: string }[], number]>(gamesQuery, { page: Math.floor(page) })
		const cards = await Promise.all((games as { id: number; name: string }[]).map(async game =>
			({ ...game, thumbnail: await thumbnail(game.id) })))
		return reply({ games: cards, pages })
	}
	if (op === "search") {
		const query = (url.searchParams.get("q") || "").trim()
		if (!query || query.length > 100) error(400, "Enter a search of 1–100 characters")
		if (url.searchParams.get("category") === "players") {
			const [users] = await db.query<{ username: string; status: string }[][]>(searchUsers, { query })
			return reply({ players: users.slice(0, 50).map(profile) })
		}
		const [games] = await db.query(searchPlaces, { query })
		return reply({ games: (games as unknown[]).slice(0, 50) })
	}
	if (op === "player") {
		const username = url.searchParams.get("username") || ""
		if (username.length > 100) error(400, "Invalid username")
		const [[found]] = await db.query<{ username: string; status: string }[][]>(
			"SELECT username, status FROM user WHERE username = $username LIMIT 1", { username })
		if (!found) error(404, "Player not found")
		return reply(profile(found))
	}
	if (op === "avatar") {
		const username = url.searchParams.get("username") || ""
		if (!username || username.length > 100) error(400, "Invalid username")
		const response = await avatarImage({ ...event, params: { username: username + "-body" } } as any)
		response.headers.set("Content-Type", "image/png")
		response.headers.set("Cache-Control", "no-store")
		return response
	}
	if (op === "game") {
		const [[place]] = await db.query<Record<string, any>[][]>(placeQuery, {
			user: Record("user", user.id), place: Record("place", placeId(url.searchParams.get("id"))) })
		if (!place || (place.privateServer && place.ownerUser?.username !== user.username))
			error(404, "Game not found")
		// Do not expose administrative tickets or private-server secrets.
		return reply({ id: place.id, name: place.name, description: place.description,
			owner: place.ownerUser?.username || "", maxPlayers: place.maxPlayers,
			playerCount: place.players?.length || 0, clientVersion: place.clientVersion,
			thumbnail: await thumbnail(place.id) })
	}
	error(400, "Unknown Switch operation")
}

export const POST: RequestHandler = async (event) => {
	const { request, locals, cookies } = event
	const origin = request.headers.get("origin")
	if (origin && origin !== siteOrigin()) error(403, "Invalid origin")
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		error(415, "Expected JSON")
	const raw = await request.text()
	if (raw.length > 8192) error(413, "Request too large")
	let data: Record<string, any>
	try { data = JSON.parse(raw) } catch { error(400, "Invalid JSON") }
	if (!data || typeof data !== "object" || Array.isArray(data)) error(400, "Invalid request")
	// Accounts sign in with recovery phrases now, which are too long to type
	// on a Switch: the app shows a code that the player approves on /device
	if (data.op === "login")
		error(410, "Update the Mercury app: you now sign in with a code you approve on the website.")
	if (data.op === "deviceStart") {
		const { code, token } = await startDevice()
		return reply({ code, token, url: `${siteOrigin()}/device`, expiresIn: deviceCodeLifetime, interval: 5 })
	}
	if (data.op === "devicePoll") {
		const polled = await pollDevice(String(data.token || ""))
		// (state, as profiles have a status of their own)
		if (polled.status !== "approved") return reply({ state: polled.status })
		const [user] = await db.query<({ id: RecordId<"user">; username: string; status: string } | undefined)[]>(
			"SELECT id, username, status FROM ONLY $user", { user: polled.user })
		if (!user) return reply({ state: "expired" })
		const [moderated] = await db.query<unknown[][]>(
			"SELECT id FROM moderation WHERE out = $user AND active = true LIMIT 1", { user: user.id })
		// The regular hook also enforces moderation on all subsequent requests.
		if (moderated.length) error(403, "Your account is currently moderated")
		if (locals.session) await invalidateSession(locals.session)
		cookies.set(cookieName, await createSession(user.id), { ...cookieOptions, httpOnly: true, sameSite: "lax" })
		return reply({ ...profile(user), state: "ok" })
	}
	loggedIn(locals)
	if (data.op === "logout") {
		await invalidateSession(locals.session!)
		cookies.delete(cookieName, { path: "/" })
		return reply({ ok: true })
	}
	if (data.op === "join") {
		const id = placeId(data.id)
		// Reuse the web Play actions: moderation, privacy, rate limits, place
		// file existence and server startup all follow the existing policy.
		const actionEvent = () => ({ ...event, params: { id: String(id), name: "switch" },
			request: new Request(event.url, { method: "POST", body: new URLSearchParams() }) })
		const started = await actions.start!(actionEvent() as any)
		if (started && "status" in started) error(429, "Please wait before starting another game")
		await actions.join!(actionEvent() as any)
		const url = new URL(event.url)
		url.searchParams.set("placeId", String(id))
		return ayaJoin({ ...event, url } as any)
	}
	error(400, "Unknown Switch operation")
}
