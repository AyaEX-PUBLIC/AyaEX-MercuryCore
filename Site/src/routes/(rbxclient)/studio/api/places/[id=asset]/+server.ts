import { error, json } from "@sveltejs/kit"
import { type } from "arktype"
import { placeRigTypes } from "$lib/rigTypes"
import filter from "$lib/server/filter"
import { setPlacePrivacy } from "$lib/server/places"
import { studioPlace, studioPlaceInfo, studioUser } from "$lib/server/studioApi"
import { db, Record } from "$lib/server/surreal"
import updatePlaceViewQuery from "$lib/server/updatePlaceView.surql"
import { maxPlayersTest } from "$lib/typeTests"

const noStore = { headers: { "Cache-Control": "no-store" } }

export async function GET({ locals, params, request }) {
	const user = studioUser(locals, request)
	return json(
		await studioPlaceInfo(await studioPlace(user, params.id)),
		noStore
	)
}

// Studio's Game Settings: the same rules as the place's settings page
const settingsSchema = type({
	"name?": "1 <= string <= 100",
	"description?": "string <= 1000",
	"maxPlayers?": maxPlayersTest,
	"privateServer?": "boolean",
	"rigType?": type.enumerated(...placeRigTypes),
})

export async function PATCH({ locals, params, request }) {
	const user = studioUser(locals, request)
	const id = await studioPlace(user, params.id)
	const body = settingsSchema(await request.json().catch(() => null))
	if (body instanceof type.errors) error(400, body.summary)

	const place = Record("place", id)
	if (body.name !== undefined || body.description !== undefined) {
		const current = await studioPlaceInfo(id)
		const name = (body.name ?? current.name).trim()
		if (!name) error(400, "name must not be empty")
		await db.query(updatePlaceViewQuery, {
			place,
			name: filter(name),
			description: filter(
				(body.description ?? current.description).trim()
			),
		})
	}
	if (body.maxPlayers !== undefined || body.rigType !== undefined)
		await db.update(place).merge({
			...(body.maxPlayers !== undefined && {
				maxPlayers: body.maxPlayers,
			}),
			...(body.rigType !== undefined && { rigType: body.rigType }),
		})
	if (body.privateServer !== undefined)
		await setPlacePrivacy(id, body.privateServer)

	return json(await studioPlaceInfo(id), noStore)
}
