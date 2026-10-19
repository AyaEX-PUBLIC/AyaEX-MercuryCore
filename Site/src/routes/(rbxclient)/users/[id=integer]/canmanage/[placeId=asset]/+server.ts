import { engineUserId } from "$lib/server/engineUser"
import { db, Record } from "$lib/server/surreal"

// Whether an engine UserId can manage a place (only its owner can): the
// developer console asks before it shows the server log, stats and command
// line, so this only decides what the console shows. Gameservers run
// --insecure: a UserId is whatever the client claims, so the host script, not
// the website, lets the owner use the console once their join ticket is
// checked (aya/README.md, "Place owners"). The answer is only true for the
// owner asking about themselves with their session, so a gameserver asking
// (an Aya.Server without that host check) never hears true.
// The engine adds a second slash after the host (https://host//users/...),
// which Caddyfile.aya removes.

export async function GET({ locals, params }) {
	const [[owner]] = await db.query<(string | undefined)[][]>(
		"SELECT VALUE username FROM $place<-ownsPlace<-user",
		{ place: Record("place", +params.placeId) }
	)
	const canManage =
		!!owner &&
		locals.user?.username === owner &&
		engineUserId(owner) === +params.id

	return Response.json(
		{ Success: true, CanManage: canManage },
		{ headers: { "Cache-Control": "no-store" } }
	)
}
