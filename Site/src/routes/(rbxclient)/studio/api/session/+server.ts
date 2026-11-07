import { json } from "@sveltejs/kit"
import config from "$lib/server/config"
import {
	freePlaces,
	nextPlacePrice,
	placeCount,
	placeLimit,
} from "$lib/server/places"
import { studioUser } from "$lib/server/studioApi"

// Studio asks this when it starts: a reply means it runs on Mercury, so it
// shows the user's games and publishes to them
export async function GET({ locals, request }) {
	const user = studioUser(locals, request)
	const count = await placeCount(user.id)
	return json(
		{
			siteName: config.Name,
			username: user.username,
			avatarRig: user.avatarRig || "R6",
			places: {
				count,
				// administrators have no limit and pay nothing
				limit: user.permissionLevel >= 5 ? null : placeLimit,
				// what a new game costs, in whole units of the currency
				price: nextPlacePrice(user, count),
				free: freePlaces,
				currency: config.CurrencySymbol,
			},
		},
		{ headers: { "Cache-Control": "no-store" } }
	)
}
