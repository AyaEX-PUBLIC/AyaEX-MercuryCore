// Place file uploads used to come through the settings form's multipart body,
// which had to be parsed before its size could be checked. This endpoint takes
// the raw file, counts it while writing a temporary file, and only then moves
// it into place.

import { unlink } from "node:fs/promises"
import { error, json } from "@sveltejs/kit"
import { streamToTempFile } from "$lib/server/body"
import {
	isPlaceFileAtPath,
	maxPlaceFileSize,
	requireManagePlace,
	writePlaceFileFromTemp,
} from "$lib/server/places"
import { rateLimit } from "$lib/server/requestRateLimit"

export async function PUT(event) {
	const { locals, params, request, url } = event
	const origin = request.headers.get("origin")
	if (origin && origin !== url.origin) error(403, "Invalid origin")
	const site = request.headers.get("sec-fetch-site")
	if (site && site !== "same-origin") error(403, "Invalid origin")

	const id = +params.id
	if (!Number.isSafeInteger(id) || id <= 0) error(400, "Invalid place")
	const user = await requireManagePlace(locals, id)

	rateLimit(
		event,
		"placeFileUpload",
		{
			burst: 5,
			perSecond: 1 / 10,
			siteBurst: 30,
			sitePerSecond: 1 / 5,
		},
		user.id
	)

	const upload = await streamToTempFile(
		request,
		maxPlaceFileSize,
		"../data/places",
		`place-${id}`
	)

	try {
		if (upload.size === 0) error(400, "Choose a place file")
		if (!(await isPlaceFileAtPath(upload.path)))
			error(400, "That isn't a place file")
		await writePlaceFileFromTemp(id, upload.path)
	} catch (e) {
		await unlink(upload.path).catch(() => {})
		throw e
	}

	console.log("Place file uploaded", id, "by", user.username)
	return json(
		{ ok: true, size: upload.size },
		{ headers: { "Cache-Control": "no-store" } }
	)
}
