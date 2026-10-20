import { error, json } from "@sveltejs/kit"
import {
	isPlaceFile,
	maxPlaceFileSize,
	writePlaceFile,
} from "$lib/server/places"
import ratelimit from "$lib/server/ratelimit"
import { studioPlace, studioPlaceInfo, studioUser } from "$lib/server/studioApi"

// Studio's Publish: the place file as the request body. (Studio opens games
// from /game/{id}, which serves the file to its owner.)
export async function PUT({ locals, params, request }) {
	const user = studioUser(locals, request)
	const id = await studioPlace(user, params.id)

	if (Number(request.headers.get("content-length")) > maxPlaceFileSize)
		error(413, "Places must be less than 100MB in size")
	if (ratelimit(null, "studioPublish", user.id, 5))
		error(429, "Publishing too often, try again in a few seconds")

	const data = new Uint8Array(await request.arrayBuffer())
	if (data.byteLength > maxPlaceFileSize)
		error(413, "Places must be less than 100MB in size")
	if (!isPlaceFile(data)) error(400, "That isn't a place file")

	await writePlaceFile(id, data)
	return json(await studioPlaceInfo(id), {
		headers: { "Cache-Control": "no-store" },
	})
}
