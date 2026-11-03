import { createHash } from "node:crypto"
import { readdirSync } from "node:fs"
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises"
import { env } from "$env/dynamic/private"
import { error, isHttpError } from "@sveltejs/kit"
import { OPEN_CLOUD_KEY } from "$env/static/private"
import { intRegex } from "$lib/paramTests"
import {
	fileHead,
	hashFile,
	streamResponseToTempFile,
} from "$lib/server/body"
import config from "$lib/server/config"
import { db, Record } from "$lib/server/surreal"
import { isXML } from "$lib/server/xml"
import assetQuery from "./asset.surql"
import {
	requireAssetAccess,
	requirePlaceFileAccess,
} from "$lib/server/assetAuth"

const MB = 1_000_000
/** An upstream object is refused before it can become an unbounded file. */
const maxUpstreamAssetSize = 100 * MB

const headers = (hash: string) => ({
	"Content-Type": "binary/octet-stream",
	"Content-Disposition": `attachment; filename="${hash}"`,
})

const hashBytes = (file: string | Uint8Array) =>
	createHash("md5").update(file).digest("hex")

// Content-Disposition needs the object's md5 before the body is streamed.
// Hashing a large cached file on every request would read it twice; remember
// the hash until the file's size or mtime changes.
const fileHashes = new Map<
	string,
	{ size: number; mtime: number; hash: string }
>()

async function fileHash(path: string) {
	const s = await stat(path)
	const known = fileHashes.get(path)
	if (known && known.size === s.size && known.mtime === s.mtimeMs)
		return known.hash

	const hash = await hashFile(path)
	fileHashes.set(path, { size: s.size, mtime: s.mtimeMs, hash })
	if (fileHashes.size > 10_000) {
		const oldest = fileHashes.keys().next().value
		if (oldest) fileHashes.delete(oldest)
	}
	return hash
}

/** Serve a file without reading it into memory. */
async function fileResponse(path: string) {
	return new Response(Bun.file(path), {
		headers: headers(await fileHash(path)),
	})
}

const bytesResponse = (file: string) =>
	new Response(file, { headers: headers(hashBytes(file)) })

type FoundAsset = {
	id: number
	name: string
	visibility: string
}

const substitute = (text: string) =>
	text
		.replaceAll("www.roblox.com/asset", `${config.Domain}/asset`)
		.replaceAll("roblox.com/asset", `${config.Domain}/asset`)

// Only substitute if it's an XML file (re-encoding image files tends to corrupt them)
async function substituteURLs(path: string) {
	const head = await fileHead(path, 8)
	if (!isXML(head)) return await fileResponse(path)

	const text = substitute(await Bun.file(path).text())
	return bytesResponse(text)
}

async function loadPrivilegedAsset(id: number) {
	const path = `../data/server/assets/${id}`
	if (!(await Bun.file(path).exists())) return

	// Privileged assets don't need their URLs substituted

	console.log("Serving privileged", id)
	return await fileResponse(path)
}

async function loadUserAsset(id: number) {
	const path = `../data/assets/${id}`
	if (!(await Bun.file(path).exists())) return

	const [[asset]] = await db.query<FoundAsset[][]>(assetQuery, {
		asset: Record("asset", id),
	})
	if (!asset || asset.visibility === "Moderated") return

	// The asset is visible or pending
	// (allow pending assets to be shown through the api)
	const script = await substituteURLs(path)

	console.log("Serving user", id)
	return script
}

async function loadPlaceAsset(
	id: number,
	locals: App.Locals,
	request: Request,
	token: string | null
) {
	// places are stored separately (see the dedicated gameserver flow's placeFile
	// check), and RCC hosting loads them via /asset/?id= (gameserver.txt convention)
	const path = `../data/places/${id}`
	if (!(await Bun.file(path).exists())) return
	await requirePlaceFileAccess(locals, request, id, token)

	const script = await substituteURLs(path)

	console.log("Serving place", id)
	return script
}

// Aya's local asset library (files named <id> or <id>.<ext>, as served by the
// Aya API), used for assets Mercury doesn't have, such as default animations
let ayaAssetIndex: Map<number, string> | undefined

function ayaAssetPath(id: number) {
	const dir = env.AYA_ASSETS_DIR
	if (!dir) return
	if (!ayaAssetIndex) {
		ayaAssetIndex = new Map()
		try {
			for (const name of readdirSync(dir)) {
				const assetId = +name.split(".")[0]
				if (Number.isSafeInteger(assetId) && assetId > 0)
					ayaAssetIndex.set(assetId, `${dir}/${name}`)
			}
		} catch (e) {
			console.error("Failed to index AYA_ASSETS_DIR", e)
		}
	}
	return ayaAssetIndex.get(id)
}

async function loadAyaAsset(id: number) {
	const path = ayaAssetPath(id)
	if (!path) return

	console.log("Serving Aya library", id)
	return await substituteURLs(path)
}

// Assets fetched from the Aya API, Roblox or Open Cloud are cached here, up to
// ASSET_CACHE_MAX_MB (2 GiB by default); past that the oldest files go
const cacheDir = "../data/assetcache"
const cacheMax = () => (Number(env.ASSET_CACHE_MAX_MB) || 2048) * 1024 ** 2
let cacheSize: number | undefined
let evicting = false

async function cacheFiles() {
	const names = await readdir(cacheDir).catch(() => [] as string[])
	return Promise.all(
		names
			.filter(name => !name.startsWith("."))
			.map(async name => {
				const path = `${cacheDir}/${name}`
				const s = await stat(path).catch(() => null)
				return { path, size: s?.size ?? 0, mtime: s?.mtimeMs ?? 0 }
			})
	)
}

async function cacheAsset(id: number, path: string) {
	await mkdir(cacheDir, { recursive: true })
	const dest = `${cacheDir}/${id}`
	const old = await stat(dest).catch(() => null)

	if (path !== dest) {
		try {
			await rename(path, dest)
		} catch {
			// a different filesystem (or a pre-existing path): copy, then drop
			// the temporary file
			await Bun.write(dest, Bun.file(path))
			await unlink(path).catch(() => {})
		}
	}
	const bytes = (await stat(dest)).size
	if (cacheSize === undefined)
		cacheSize = (await cacheFiles()).reduce((n, f) => n + f.size, 0)
	else cacheSize += bytes - (old?.size ?? 0)
	if (cacheSize <= cacheMax() || evicting) return dest

	// drop the oldest files until the cache is 10% under the limit, keeping
	// the object we just wrote even if it alone is over the budget
	evicting = true
	try {
		const files = (await cacheFiles()).sort((a, b) => a.mtime - b.mtime)
		cacheSize = files.reduce((n, f) => n + f.size, 0)
		for (const f of files) {
			if (cacheSize <= cacheMax() * 0.9) break
			if (f.path === dest) continue
			await unlink(f.path).catch(() => {})
			cacheSize -= f.size
		}
	} finally {
		evicting = false
	}
	return dest
}

async function loadCachedAsset(id: number) {
	const path = `${cacheDir}/${id}`
	if (!(await Bun.file(path).exists())) return

	console.log("Serving cached", id)
	return await fileResponse(path)
}

// Each new asset from upstream spends the operator's Roblox credentials, so
// every principal has a small budget (a burst, refilled each second), and so
// does the whole site. Upstream downloads also have per-principal and site
// concurrency caps, so a few clients can't fill the disk cache at once.
type Budget = { tokens: number; at: number }

const perUserBurst = 50
const perUserPerSecond = 1
const siteBurst = 250
const sitePerSecond = 5
const perUserConcurrency = 3
const siteConcurrency = 25

const budgets = new Map<string, Budget>()
const siteBudget: Budget = { tokens: siteBurst, at: Date.now() }
const inFlight = new Map<string, number>()
let siteInFlight = 0

function refill(b: Budget, burst: number, perSecond: number, now: number) {
	b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 1000) * perSecond)
	b.at = now
}

function takeUpstreamFetch(principal: string) {
	if (
		(inFlight.get(principal) ?? 0) >= perUserConcurrency ||
		siteInFlight >= siteConcurrency
	)
		error(429, "Too many new assets requested, try again shortly")

	const now = Date.now()
	const own = budgets.get(principal) ?? { tokens: perUserBurst, at: now }
	refill(own, perUserBurst, perUserPerSecond, now)
	refill(siteBudget, siteBurst, sitePerSecond, now)
	if (own.tokens < 1 || siteBudget.tokens < 1)
		error(429, "Too many new assets requested, try again shortly")
	own.tokens--
	siteBudget.tokens--
	budgets.set(principal, own)

	const ownInFlight = (inFlight.get(principal) ?? 0) + 1
	inFlight.set(principal, ownInFlight)
	siteInFlight++

	// forget principals whose budget has filled up again
	if (budgets.size > 10_000)
		for (const [p, b] of budgets) {
			refill(b, perUserBurst, perUserPerSecond, now)
			if (b.tokens >= perUserBurst) budgets.delete(p)
		}

	let released = false
	return () => {
		if (released) return
		released = true
		siteInFlight--
		const left = (inFlight.get(principal) ?? 1) - 1
		if (left > 0) inFlight.set(principal, left)
		else inFlight.delete(principal)
	}
}

/** How the Aya API, Roblox and Open Cloud bodies become cache files. */
async function cacheUpstream(id: number, res: Response, label: string) {
	const download = await streamResponseToTempFile(
		res,
		maxUpstreamAssetSize,
		cacheDir,
		`asset-${id}`
	)

	try {
		// XML asset URLs are rewritten for the local site; binary objects
		// (images, meshes, place files) are left alone
		if (isXML(await fileHead(download.path, 8))) {
			const text = substitute(await Bun.file(download.path).text())
			await Bun.write(download.path, text)
		}

		const cached = await cacheAsset(id, download.path)
		console.log(`Serving ${label}`, id)
		return await fileResponse(cached)
	} catch (e) {
		await unlink(download.path).catch(() => {})
		throw e
	}
}

// The Aya compatibility API (AYA_ASSET_FALLBACK_URL) serves Roblox assets
// through its own credentials; results are cached like Open Cloud ones
async function loadAyaApiAsset(id: number) {
	const base = env.AYA_ASSET_FALLBACK_URL?.replace(/\/+$/, "")
	if (!base) return

	try {
		const res = await fetch(`${base}/asset/?id=${id}`)
		if (!res.ok) return
		return await cacheUpstream(id, res, "Aya API")
	} catch (e) {
		if (isHttpError(e)) throw e
		console.error("Aya API asset fallback failed", e)
	}
}

// Roblox's asset delivery, signed in with the operator's account
// (ROBLOSECURITY, its .ROBLOSECURITY cookie). Roblox ends a login used from
// somewhere other than where it was made, so only set it where it was made
// (for a VPS, through deploy/wireguard.sh)
async function loadRobloxAsset(id: number) {
	const cookie = env.ROBLOSECURITY
	if (!cookie) return

	try {
		let res = await fetch(
			`https://assetdelivery.roblox.com/v1/asset/?id=${id}`,
			{
				headers: {
					Cookie: `.ROBLOSECURITY=${cookie}`,
					"User-Agent": "Roblox/WinInet",
				},
				redirect: "manual",
			}
		)
		// the file itself comes from Roblox's CDN, which doesn't need the cookie
		const location = res.headers.get("location")
		if (res.status >= 300 && res.status < 400 && location)
			res = await fetch(
				new URL(location, "https://assetdelivery.roblox.com/")
			)
		if (res.status === 401)
			console.error(
				"Roblox refused ROBLOSECURITY: the login has ended (used from elsewhere, or signed out)"
			)
		if (!res.ok) return

		return await cacheUpstream(id, res, "Roblox")
	} catch (e) {
		if (isHttpError(e)) throw e
		console.error("Roblox asset delivery failed", e)
	}
}

async function loadOpenCloudAsset(f: typeof globalThis.fetch, id: number) {
	try {
		const req = await f(
			`https://apis.roblox.com/asset-delivery-api/v1/assetId/${id}`,
			{ headers: { "X-API-Key": OPEN_CLOUD_KEY } }
		)
		if (!req.ok) return

		const json = (await req.json()) as { location: string }
		const location = json.location
		if (!location) return

		const res = await f(location)
		if (!res.ok) return

		return await cacheUpstream(id, res, "Open Cloud")
	} catch (e) {
		if (isHttpError(e)) throw e
		console.error(e)
		error(500, "Failed to fetch Open Cloud asset")
	}
}

// ids that no upstream had, so asking for them again doesn't reach them
// (with the operator's credentials) every time
const missing = new Map<number, number>()
const missingFor = 10 * 60 * 1000

function rememberMissing(id: number) {
	missing.delete(id) // re-adding keeps the map in expiry order
	missing.set(id, Date.now() + missingFor)
	for (const [old, expires] of missing) {
		if (expires > Date.now() && missing.size <= 100_000) break
		missing.delete(old)
	}
}

export async function GET({ fetch: f, url, locals, request }) {
	requireAssetAccess(locals, request)

	const assetId = url.searchParams.get("id")
	if (!assetId || !intRegex.test(assetId) || assetId.length > 15)
		error(400, "Invalid Request")

	// all asset ids are now numbered
	const id = +assetId
	console.log("Requested asset", id)

	const result2b = await loadPlaceAsset(
		id,
		locals,
		request,
		url.searchParams.get("token")
	)
	if (result2b) return result2b

	const result1 = await loadPrivilegedAsset(id)
	if (result1) return result1

	// Try loading as a user asset
	const result2 = await loadUserAsset(id)
	if (result2) return result2

	const resultAya = await loadAyaAsset(id)
	if (resultAya) return resultAya

	const cached = await loadCachedAsset(id)
	if (cached) return cached

	if ((missing.get(id) || 0) > Date.now()) error(404, "Not Found")

	// past here the asset comes from upstream: a user's budget, or for
	// gameservers the place they say they host (InsertService sends it)
	const principal = locals.user
		? `user:${locals.user.id}`
		: `server:${url.searchParams.get("serverplaceid") ?? ""}`
	const release = takeUpstreamFetch(principal)

	try {
		const resultAyaApi = await loadAyaApiAsset(id)
		if (resultAyaApi) return resultAyaApi

		const resultRoblox = await loadRobloxAsset(id)
		if (resultRoblox) return resultRoblox

		try {
			const result3 = await loadOpenCloudAsset(f, id)
			if (result3) return result3
		} catch (e) {
			rememberMissing(id)
			throw e
		}

		rememberMissing(id)
		error(404, "Not Found")
	} finally {
		release()
	}
}
