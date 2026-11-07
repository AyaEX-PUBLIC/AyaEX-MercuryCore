// Place changes shared by the site's forms and Studio's (routes/(rbxclient)/studio/api)

import { rename } from "node:fs/promises"
import { error } from "@sveltejs/kit"
import type { PlaceRigType } from "$lib/rigTypes"
import { authorise } from "$lib/server/auth"
import { fileHead } from "$lib/server/body"
import config from "$lib/server/config"
import createQuery from "$lib/server/createPlace.surql"
import { burn, mint, UNIT } from "$lib/server/economy"
import filter from "$lib/server/filter"
import { randomAssetId } from "$lib/server/id"
import oneAtATime from "$lib/server/oneAtATime"
import { db, Record } from "$lib/server/surreal"
import { encode } from "$lib/urlName"

// Places always run on the Aya 2016 client (WebAssembly Player and native
// Aya.Server), so it is the only version offered
export const lockedClientVersion = 2016

/** Places a user may own; administrators have no limit. */
export const placeLimit = 10

/** Each user's first places are free; each one after costs placeCost. */
export const freePlaces = 2
/** In whole currency units */
export const placeCost = 100

/**
 * What the user's next place costs, in whole currency units, when they own
 * `count`. Administrators pay nothing (they have no limit either).
 */
export const nextPlacePrice = (user: User, count: number) =>
	user.permissionLevel >= 5 || count < freePlaces ? 0 : placeCost

/** Place files can be up to this size. */
export const maxPlaceFileSize = 100e6

export async function placeCount(user: string) {
	const [[count]] = await db.query<number[][]>(
		"SELECT VALUE count(->ownsPlace->place) FROM $user",
		{ user: Record("user", user) }
	)
	return count
}

export type CreatePlaceResult =
	| { id: number }
	| { status: 402 | 403; error: string }

/**
 * Creates a place owned by the user, charging nextPlacePrice for it. Refuses
 * when they already have as many as they may, when it costs more than
 * `shownPrice` (what the user was told, in whole currency units), or when
 * they can't pay. Only administrators set a selfhosted address.
 */
export async function createPlace(
	f: typeof globalThis.fetch,
	user: User,
	place: {
		name: string
		description: string
		maxPlayers: number
		privateServer?: boolean
		rigType?: PlaceRigType
		serverAddress?: string
		serverPort?: number
	},
	shownPrice = 0
): Promise<CreatePlaceResult> {
	const isAdmin = user.permissionLevel >= 5
	const id = randomAssetId() // listen, this still isn't great, but whatever atp
	const name = filter(place.name)
	const create = () =>
		db.query(createQuery, {
			id,
			user: Record("user", user.id),
			name,
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

	if (isAdmin) {
		await create()
		return { id }
	}

	// everyone else has a limit and a price, checked, paid and created one
	// request at a time so concurrent requests can't both pass
	return oneAtATime(`placeCreate:${user.id}`, async () => {
		const count = await placeCount(user.id)
		if (count >= placeLimit)
			return {
				status: 403,
				error: `You can't have more than ${placeLimit} games`,
			} as const

		const price = nextPlacePrice(user, count)
		if (price > shownPrice)
			return {
				status: 402,
				error: `A new game costs ${config.CurrencySymbol}${price} (your first ${freePlaces} are free). Reload to see the price, then try again.`,
			} as const

		if (price) {
			const paid = await burn(
				f,
				user.id,
				price * UNIT,
				`Created game ${name}`,
				`/place/${id}/${encode(name)}`,
				{}
			)
			if (!paid.ok) return { status: 402, error: paid.msg } as const
		}
		try {
			await create()
		} catch (e) {
			if (price)
				await mint(
					f,
					user.id,
					price * UNIT,
					`Refund: game ${name} wasn't created`
				)
			throw e
		}
		return { id }
	})
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
