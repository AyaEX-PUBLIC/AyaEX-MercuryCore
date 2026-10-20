import { json } from "@sveltejs/kit"
import config from "$lib/server/config"
import { placeCount, placeLimit } from "$lib/server/places"
import { studioUser } from "$lib/server/studioApi"

// Studio asks this when it starts: a reply means it runs on Mercury, so it
// shows the user's games and publishes to them
export async function GET({ locals, request }) {
	const user = studioUser(locals, request)
	return json(
		{
			siteName: config.Name,
			username: user.username,
			avatarRig: user.avatarRig || "R6",
			places: {
				count: await placeCount(user.id),
				// administrators have no limit
				limit: user.permissionLevel >= 5 ? null : placeLimit,
			},
		},
		{ headers: { "Cache-Control": "no-store" } }
	)
}
