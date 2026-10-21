// Studio's Mercury integration (routes/(rbxclient)/studio/api): Aya Studio
// runs on the Site's origin, so its requests carry the user's session.

import { error } from "@sveltejs/kit"
import { canManagePlace } from "$lib/server/places"
import { db, Record } from "$lib/server/surreal"
import { encode } from "$lib/urlName"

/** The signed-in user, for a request from a page on this site. */
export function studioUser(locals: App.Locals, request: Request) {
	// browsers say where a request comes from; only Studio's own page may use
	// these, so other sites can't act for a signed-in user
	const site = request.headers.get("sec-fetch-site")
	if (site && site !== "same-origin") error(403, "Only Studio can use this")
	if (!locals.user) error(401, "Log in to use Studio with your games")
	return locals.user
}

/** The place id, if this user may change the place. */
export async function studioPlace(user: User, id: string) {
	const place = +id
	const [[exists]] = await db.query<boolean[][]>(
		"SELECT VALUE !deleted FROM $place",
		{ place: Record("place", place) }
	)
	if (!exists) error(404, "This game doesn't exist")
	if (!(await canManagePlace(user, place)))
		error(403, "Only the game's owner can change it")
	return place
}

export type StudioPlace = {
	id: number
	name: string
	description: string
	maxPlayers: number
	privateServer: boolean
	rigType: string
	updated: string
	hasFile: boolean
	url: string
}

/** What Studio shows of a place. */
export async function studioPlaceInfo(id: number) {
	const [[place]] = await db.query<Omit<StudioPlace, "hasFile" | "url">[][]>(
		`SELECT
			record::id(id) AS id,
			name,
			fn::currentContent($this.description) AS description,
			maxPlayers,
			privateServer,
			rigType ?? "R6" AS rigType,
			updated
		FROM $place`,
		{ place: Record("place", id) }
	)
	return {
		...place,
		hasFile: await Bun.file(`../data/places/${id}`).exists(),
		url: `/place/${id}/${encode(place.name)}`,
	} satisfies StudioPlace
}
