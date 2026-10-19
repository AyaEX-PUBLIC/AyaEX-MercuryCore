import { createHash } from "node:crypto"
import { readdirSync } from "node:fs"
import { env } from "$env/dynamic/private"
import { error } from "@sveltejs/kit"
import { OPEN_CLOUD_KEY } from "$env/static/private"
import { intRegex } from "$lib/paramTests"
import config from "$lib/server/config"
import { db, Record } from "$lib/server/surreal"
import { isXML } from "$lib/server/xml"
import assetQuery from "./asset.surql"
import {
	requireAssetAccess,
	requirePlaceFileAccess,
} from "$lib/server/assetAuth"

const headers = (file: string | Uint8Array) => ({
	"Content-Type": "binary/octet-stream",
	"Content-Disposition": `attachment; filename="${createHash("md5")
		.update(file)
		.digest("hex")}"`,
})

const response = (file: string | Uint8Array<ArrayBuffer>) =>
	new Response(file, { headers: headers(file) })

type FoundAsset = {
	id: number
	name: string
	visibility: string
}

// Only substitute if it's an XML file (re-encoding image files tends to corrupt them)
async function substituteURLs(file: Bun.BunFile | Response) {
	const buf = await file.arrayBuffer()
	if (!isXML(buf)) return new Uint8Array(buf)

	const rep = `${config.Domain}/asset`
	return new TextDecoder()
		.decode(buf)
		.replaceAll("www.roblox.com/asset", rep)
		.replaceAll("roblox.com/asset", rep)
}

async function loadPrivilegedAsset(id: number) {
	const file = Bun.file(`../data/server/assets/${id}`)
	if (!(await file.exists())) return

	// Privileged assets don't need their URLs substituted

	console.log("Serving privileged", id)
	return response(new Uint8Array(await file.arrayBuffer()))
}

async function loadUserAsset(id: number) {
	const file = Bun.file(`../data/assets/${id}`)
	if (!(await file.exists())) return

	const [[asset]] = await db.query<FoundAsset[][]>(assetQuery, {
		asset: Record("asset", id),
	})
	if (!asset || asset.visibility === "Moderated") return

	// The asset is visible or pending
	// (allow pending assets to be shown through the api)
	const script = await substituteURLs(file)

	console.log("Serving user", id)
	return response(script)
}

async function loadPlaceAsset(
	id: number,
	locals: App.Locals,
	request: Request,
	token: string | null
) {
	// places are stored separately (see the dedicated gameserver flow's placeFile
	// check), and RCC hosting loads them via /asset/?id= (gameserver.txt convention)
	const file = Bun.file(`../data/places/${id}`)
	if (!(await file.exists())) return
	await requirePlaceFileAccess(locals, request, id, token)

	const script = await substituteURLs(file)

	console.log("Serving place", id)
	return response(script)
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
	return response(await substituteURLs(Bun.file(path)))
}

// The Aya compatibility API (AYA_ASSET_FALLBACK_URL) serves Roblox assets
// through its own credentials; results are cached like Open Cloud ones
async function loadAyaApiAsset(id: number) {
	const base = env.AYA_ASSET_FALLBACK_URL?.replace(/\/+$/, "")
	if (!base) return

	const cachepath = `../data/assetcache/${id}`
	const cached = Bun.file(cachepath)
	if (await cached.exists()) {
		console.log("Serving cached Aya API", id)
		return response(new Uint8Array(await cached.arrayBuffer()))
	}

	try {
		const res = await fetch(`${base}/asset/?id=${id}`)
		if (!res.ok) return

		const asset = await substituteURLs(res)
		await Bun.write(cachepath, asset)

		console.log("Serving Aya API", id)
		return response(asset)
	} catch (e) {
		console.error("Aya API asset fallback failed", e)
	}
}

async function loadOpenCloudAsset(f: typeof globalThis.fetch, id: number) {
	const cachepath = `../data/assetcache/${id}`
	const file = Bun.file(cachepath)
	if (await file.exists()) {
		console.log("Serving cached Open Cloud", id)
		return response(new Uint8Array(await file.arrayBuffer()))
	}

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

		// cache the asset
		const script = await substituteURLs(res)
		await Bun.write(cachepath, script)

		console.log("Serving Open Cloud", id)
		return response(script)
	} catch (e) {
		console.error(e)
		error(500, "Failed to fetch Open Cloud asset")
	}
}

// ids that neither upstream had, so asking for them again doesn't reach them
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

	if ((missing.get(id) || 0) > Date.now()) error(404, "Not Found")

	const resultAyaApi = await loadAyaApiAsset(id)
	if (resultAyaApi) return resultAyaApi

	try {
		const result3 = await loadOpenCloudAsset(f, id)
		if (result3) return result3
	} catch (e) {
		rememberMissing(id)
		throw e
	}

	rememberMissing(id)
	error(404, "Not Found")
}
