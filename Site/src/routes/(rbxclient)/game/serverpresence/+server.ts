import { error } from "@sveltejs/kit"
import { rewardPlaytime } from "$lib/server/playtime"
import { db, findWhere } from "$lib/server/surreal"
import pingQuery from "./ping.surql"

// Aya.Server doesn't identify as Roblox/WinInet, so the place's secret server
// ticket is what authorises the ping
export async function GET({ fetch, url }) {
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
