import { timingSafeEqual } from "node:crypto"
import { error } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"

const keyHeader = "accesskey"

function hasServerKey(request: Request) {
	const key = env.ASSET_KEY
	const given = request.headers.get(keyHeader)
	if (!key || !given) return false
	const a = Buffer.from(given)
	const b = Buffer.from(key)
	return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Asset routes serve place files, avatars and the Roblox asset fallback, so
 * they need either a logged-in user (the browser Player sends the session
 * cookie) or the ASSET_KEY that Aya.Server sends with its own requests
 * (--httpAccessKey).
 */
export function requireAssetAccess(locals: App.Locals, request: Request) {
	if (locals.user || hasServerKey(request)) return
	error(401, "Unauthorized")
}
