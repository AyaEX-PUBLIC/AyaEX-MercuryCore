import { requireServerKey } from "$lib/server/assetAuth"
import { engineIdTaken, engineUserId } from "$lib/server/engineUser"
import { db, Record } from "$lib/server/surreal"
import verifyQuery from "./verify.surql"

// Called by the Aya gameserver (host.lua) when a player arrives: "true" if the
// player's join ticket was issued by /game/join/aya to that account for that
// place. Tickets are single use, so a ticket seen by other players is worthless.
export async function GET({ request, url }) {
	requireServerKey(request)

	const ticket = url.searchParams.get("ticket") ?? ""
	const userId = Number(url.searchParams.get("userId"))
	const placeId = url.searchParams.get("placeId") ?? ""
	let valid = false

	if (/^[0-9a-f]{48}$/.test(ticket) && /^\d+$/.test(placeId)) {
		const [, , found] = await db.query<[null, null, { username: string } | null]>(verifyQuery, {
			ticket: Record("joinTicket", ticket),
			place: Record("place", +placeId),
		})
		// an older account with a colliding UserId keeps it (see engineUser.ts)
		valid =
			!!found &&
			engineUserId(found.username) === userId &&
			!(await engineIdTaken(found.username))
	}

	return new Response(valid ? "true" : "false", {
		headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
	})
}
