import { error } from "@sveltejs/kit"
import { db, find, Record } from "$lib/server/surreal"
import pingQuery from "./ping.surql"

// The browser Player can't set the Roblox/WinInet user agent, so a valid
// ticket is what authorises the ping
export async function GET({ url }) {
	const ticket = url.searchParams.get("ticket") as string
	if (!ticket) error(400, "Invalid Request")
	if (!(await find("playing", ticket))) error(400, "Ticket not found")

	await db.query(pingQuery, { playing: Record("playing", ticket) })

	return new Response("OK", {
		headers: {
			Pragma: "no-cache",
			"Cache-Control": "no-cache",
		},
	})
}
