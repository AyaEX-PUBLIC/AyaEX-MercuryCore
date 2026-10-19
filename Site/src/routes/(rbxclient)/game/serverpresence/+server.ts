import { error } from "@sveltejs/kit"
import { requireServerKey } from "$lib/server/assetAuth"
import { rewardPlaytime } from "$lib/server/playtime"
import { db, findWhere } from "$lib/server/surreal"
import pingQuery from "./ping.surql"

// Only gameservers report presence (it marks players as playing and pays
// playtime): Aya.Server sends the server key (accesskey) with its host
// script's requests, and the place's server ticket says which place it hosts.
// The owner can see the ticket, so it can't authorise the ping on its own.
export async function GET({ fetch, request, url }) {
	requireServerKey(request)
	const ticket = url.searchParams.get("ticket") as string
	if (!ticket) error(400, "Invalid Request")
	if (!(await findWhere("place", "serverTicket = $ticket", { ticket })))
		error(400, "Ticket not found")

	// optional comma-separated usernames of the players connected to the
	// gameserver, which mark them as playing
	const players = (url.searchParams.get("players") ?? "")
		.split(",")
		.filter(name => /^[A-Za-z0-9_]{3,21}$/.test(name))
		.slice(0, 100)

	const results = await db.query<unknown[]>(pingQuery, { ticket, players })
	const inGame = results.at(-1)
	if (Array.isArray(inGame) && inGame.length) await rewardPlaytime(fetch, inGame as string[])

	return new Response("OK", {
		headers: {
			Pragma: "no-cache",
			"Cache-Control": "no-cache",
		},
	})
}
