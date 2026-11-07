import { error, json } from "@sveltejs/kit"
import { type } from "arktype"
import { placeRigTypes } from "$lib/rigTypes"
import { createPlace } from "$lib/server/places"
import { studioPlaceInfo, studioUser } from "$lib/server/studioApi"
import { db, Record } from "$lib/server/surreal"
import { maxPlayersTest } from "$lib/typeTests"

const noStore = { headers: { "Cache-Control": "no-store" } }

// the games Studio lists (its Start page and Open from Mercury)
export async function GET({ locals, request }) {
	const user = studioUser(locals, request)
	const [owned] = await db.query<{ id: number }[][]>(
		`SELECT record::id(id) AS id, updated FROM $user->ownsPlace->place
		WHERE !deleted ORDER BY updated DESC`,
		{ user: Record("user", user.id) }
	)
	return json(
		{
			places: await Promise.all(
				owned.map(place => studioPlaceInfo(place.id))
			),
		},
		noStore
	)
}

const createSchema = type({
	name: "3 <= string <= 50",
	description: "1 <= string <= 1000",
	maxPlayers: maxPlayersTest.default(10),
	privateServer: "boolean = false",
	rigType: type.enumerated(...placeRigTypes).default("R6"),
	// what Studio showed the game costs (session's places.price), so it's
	// never more than that; Studio versions that don't show it send nothing
	price: "number.integer >= 0 = 0",
})

// Publish as a new game (Studio uploads its file next, to places/{id}/file)
export async function POST({ fetch, locals, request }) {
	const user = studioUser(locals, request)
	const body = createSchema(await request.json().catch(() => null))
	if (body instanceof type.errors) error(400, body.summary)

	const name = body.name.trim()
	const description = body.description.trim()
	if (name.length < 3) error(400, "name must be at least 3 characters")
	if (!description) error(400, "description must not be empty")

	const { price, ...place } = body
	const created = await createPlace(
		fetch,
		user,
		{ ...place, name, description },
		price
	)
	if ("error" in created) error(created.status, created.error)
	return json(await studioPlaceInfo(created.id), { status: 201, ...noStore })
}
