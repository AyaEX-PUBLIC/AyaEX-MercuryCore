import { error } from "@sveltejs/kit"
import config from "$lib/server/config"
import { siteOrigin } from "$lib/server/origin"
import idToPort from "$lib/server/idToPort"
import { SignScript } from "$lib/server/sign"
import { db, Record } from "$lib/server/surreal"
import placeQuery from "./place.surql"

type Place = {
	id: number
	serverPort: number
	serverTicket: string
}

export async function GET({ params }) {
	if (config.Gameservers.Hosting === "Selfhosted")
		error(400, "Selfhosted servers are not supported")

	const id = +params.id

	const [[place]] = await db.query<Place[][]>(placeQuery, {
		place: Record("place", id),
	})
	if (!place) error(404, "Place not found")

	// TODO: move to url without param
	const serverPresenceUrl = `http://${config.DomainInsecure}/game/serverpresence?ticket=${place.serverTicket}`

	const scriptFile = Bun.file("../data/server/loadscripts/host.lua")
	const script = (await scriptFile.text())
		.replaceAll("_BASE_URL", `"${config.DomainInsecure}"`)
		.replaceAll("_SITE_ORIGIN", `"${siteOrigin()}"`)
		// versioned by the file's modification time: Aya.Server serves cached
		// responses first, so an unchanged URL would load the previous upload
		.replaceAll(
			"_MAP_LOCATION",
			`"http://${config.DomainInsecure}/asset/?id=${id}&v=${Bun.file(`../data/places/${id}`).lastModified}"`
		)
		.replaceAll("_SERVER_PORT", idToPort(id).toString())
		.replaceAll("_SERVER_PRESENCE_URL", `"${serverPresenceUrl}"`)

	return new Response(await SignScript(script))
}
