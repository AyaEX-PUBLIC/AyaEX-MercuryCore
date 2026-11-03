import { unlink } from "node:fs/promises"
import { error, json } from "@sveltejs/kit"
import { streamToTempFile } from "$lib/server/body"
import {
	isPlaceFileAtPath,
	maxPlaceFileSize,
	writePlaceFileFromTemp,
} from "$lib/server/places"
import ratelimit from "$lib/server/ratelimit"
import { studioPlace, studioPlaceInfo, studioUser } from "$lib/server/studioApi"

// Studio's Publish: the place file as the request body. (Studio opens games
// from /game/{id}, which serves the file to its owner.)
export async function PUT({ locals, params, request }) {
	const user = studioUser(locals, request)
	const id = await studioPlace(user, params.id)

	if (ratelimit(null, "studioPublish", user.id, 5))
		error(429, "Publishing too often, try again in a few seconds")

	// counts bytes while writing, so Content-Length can't be omitted to make
	// the server buffer an endless upload
	const upload = await streamToTempFile(
		request,
		maxPlaceFileSize,
		"../data/places",
		`studio-${id}`
	)

	try {
		if (upload.size === 0) error(400, "That isn't a place file")
		if (!(await isPlaceFileAtPath(upload.path)))
			error(400, "That isn't a place file")
		await writePlaceFileFromTemp(id, upload.path)
	} catch (e) {
		await unlink(upload.path).catch(() => {})
		throw e
	}

	return json(await studioPlaceInfo(id), {
		headers: { "Cache-Control": "no-store" },
	})
}
