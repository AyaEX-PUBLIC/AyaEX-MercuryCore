import { createHmac, timingSafeEqual } from "node:crypto"
import { error } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import { db, Record } from "$lib/server/surreal"

const keyHeader = "accesskey"

const sameKey = (given: string | null | undefined, key: string | undefined) => {
	if (!key || !given) return false
	const a = Buffer.from(given)
	const b = Buffer.from(key)
	return a.length === b.length && timingSafeEqual(a, b)
}

export const hasServerKey = (request: Request) =>
	sameKey(request.headers.get(keyHeader), env.ASSET_KEY)

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

/**
 * Whether a request may ask what an account owns: a gameserver (the server key)
 * can ask about any player, a signed-in player only about themselves, so
 * nobody can read another account's inventory.
 */
export const mayAskAbout = (
	locals: App.Locals,
	request: Request,
	userId: string | undefined
) => hasServerKey(request) || (!!userId && locals.user?.id === userId)

/** Routes only gameservers may call (badges, developer product receipts). */
export function requireServerKey(request: Request) {
	if (!hasServerKey(request)) error(401, "Unauthorized")
}

/**
 * Routes only the Orbiter may call, such as the host script that carries a
 * place's server ticket: it sends GAMESERVER_KEY as a bearer token.
 */
export function requireOrbiterKey(request: Request) {
	const auth = request.headers.get("Authorization")
	if (
		!auth?.startsWith("Bearer ") ||
		!sameKey(auth.slice(7), env.GAMESERVER_KEY)
	)
		error(401, "Unauthorized")
}

/**
 * What a gameserver needs, besides the server key, to download the file of the
 * place it hosts: /game/{id}/serve puts it in the host script's map URL. Every
 * gameserver has the server key and runs its place owner's scripts, which can
 * make it load other assets (InsertService), so the key alone opens no place.
 * Derived from GAMESERVER_KEY and the place's server ticket.
 */
export function placeFileToken(place: number, serverTicket: string) {
	if (!env.GAMESERVER_KEY) error(500, "GAMESERVER_KEY is not set")
	return createHmac("sha256", env.GAMESERVER_KEY)
		.update(`place-file\n${place}\n${serverTicket}`)
		.digest("hex")
}

/**
 * A place's file is its source, so it's only for the gameserver hosting it
 * (the server key and the place's token), the place's owner, and moderators.
 */
export async function requirePlaceFileAccess(
	locals: App.Locals,
	request: Request,
	place: number,
	token: string | null
) {
	if (hasServerKey(request)) {
		const [[serverTicket]] = await db.query<(string | undefined)[][]>(
			"SELECT VALUE serverTicket FROM $place",
			{ place: Record("place", place) }
		)
		if (serverTicket && sameKey(token, placeFileToken(place, serverTicket)))
			return
		error(403, "The server key only opens the place its gameserver hosts")
	}
	const { user } = locals
	if (!user) error(401, "Unauthorized")
	if (user.permissionLevel >= 4) return
	const [[owner]] = await db.query<(string | undefined)[][]>(
		"SELECT VALUE record::id(id) FROM $place<-ownsPlace<-user",
		{ place: Record("place", place) }
	)
	if (owner !== user.id) error(403, "Only the place's owner can download it")
}
