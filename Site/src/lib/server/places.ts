// Place changes shared by the site's forms and Studio's (routes/(rbxclient)/studio/api)

import { rename } from "node:fs/promises"
import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { fileHead } from "$lib/server/body"
import createQuery from "$lib/server/createPlace.surql"
import filter from "$lib/server/filter"
import { randomAssetId } from "$lib/server/id"
import oneAtATime from "$lib/server/oneAtATime"
import { db, Record } from "$lib/server/surreal"
import type { PlaceRigType } from "$lib/rigTypes"

// Places always run on the Aya 2016 client (WebAssembly Player and native
// Aya.Server), so it is the only version offered
export const lockedClientVersion = 2016

/** Places a user may own; administrators have no limit. */
export const placeLimit = 5

/** Place files can be up to this size. */
export const maxPlaceFileSize = 100e6

export async function placeCount(user: string) {
	const [[count]] = await db.query<number[][]>(
		"SELECT VALUE count(->ownsPlace->place) FROM $user",
		{ user: Record("user", user) }
	)
	return count
}

/**
 * Creates a place owned by the user, or returns undefined when they already
 * have as many as they may. Only administrators set a selfhosted address.
 */
export async function createPlace(
	user: User,
	place: {
		name: string
		description: string
		maxPlayers: number
		privateServer?: boolean
		rigType?: PlaceRigType
		serverAddress?: string
		serverPort?: number
	}
) {
	const isAdmin = user.permissionLevel >= 5
	const id = randomAssetId() // listen, this still isn't great, but whatever atp
	const create = () =>
		db.query(createQuery, {
			id,
			user: Record("user", user.id),
			name: filter(place.name),
			description: filter(place.description),
			serverAddress: isAdmin
				? (place.serverAddress ?? "localhost")
				: "localhost",
			serverPort: isAdmin ? (place.serverPort ?? 53640) : 53640,
			privateServer: place.privateServer ?? false,
			maxPlayers: place.maxPlayers,
			rigType: place.rigType ?? "R6",
			clientVersion: lockedClientVersion,
		})

	// everyone but administrators has a limit, checked and created one request
	// at a time so concurrent requests can't both pass
	if (isAdmin) await create()
	else {
		const created = await oneAtATime(`placeCreate:${user.id}`, async () => {
			if ((await placeCount(user.id)) >= placeLimit) return false
			await create()
			return true
		})
		if (!created) return
	}
	return id
}

/** Can this user change the place (its owner or a moderator)? */
export async function canManagePlace(user: User, place: number) {
	if (user.permissionLevel >= 4) return true
	const [[owner]] = await db.query<(string | undefined)[][]>(
		"SELECT VALUE record::id(id) FROM $place<-ownsPlace<-user",
		{ place: Record("place", place) }
	)
	return owner === user.id
}

/** The signed-in user, if they may change this place; 404s unknown places. */
export async function requireManagePlace(locals: App.Locals, place: number) {
	const { user } = await authorise(locals)
	const [found] = await db.query<({ id: unknown } | null)[]>(
		"SELECT id FROM ONLY $place",
		{ place: Record("place", place) }
	)
	if (!found) error(404, "Place not found")
	if (!(await canManagePlace(user, place)))
		error(403, "You do not have permission to update this place.")

	return user
}

export async function setPlacePrivacy(id: number, privateServer: boolean) {
	const place = Record("place", id)
	const [[wasPrivate]] = await db.query<boolean[][]>(
		"SELECT VALUE privateServer FROM $place",
		{ place }
	)
	await db.update(place).merge({ privateServer })
	// anyone could see the old private link while the place was public, so
	// making it private gives it a new one
	if (privateServer && !wasPrivate)
		await db.query("UPDATE $place SET privateTicket = rand::id()", {
			place,
		})
}

/**
 * Saves a place file. Running servers keep the version they loaded; new ones
 * load this one.
 */
export async function writePlaceFile(id: number, file: Blob | Uint8Array) {
	await Bun.write(`../data/places/${id}`, file)
	await db.query("UPDATE $place SET updated = time::now()", {
		place: Record("place", id),
	})
}

/**
 * Saves a place file that was streamed into a temporary file. Renaming inside
 * ../data/places is atomic, so a failed upload never replaces the old file.
 */
export async function writePlaceFileFromTemp(id: number, path: string) {
	await rename(path, `../data/places/${id}`)
	await db.query("UPDATE $place SET updated = time::now()", {
		place: Record("place", id),
	})
}

/** Does this look like a Roblox place file, binary or XML? */
export function isPlaceFile(data: Uint8Array) {
	const head = new TextDecoder().decode(data.subarray(0, 256)).trimStart()
	return (
		head.startsWith("<roblox") ||
		(head.startsWith("<?xml") && head.includes("<roblox"))
	)
}

/** The same check, without reading a whole uploaded place into memory. */
export async function isPlaceFileAtPath(path: string) {
	return isPlaceFile(await fileHead(path, 256))
}
