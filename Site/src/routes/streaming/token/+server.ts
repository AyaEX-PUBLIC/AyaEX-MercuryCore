import { error } from "@sveltejs/kit"
import { engineUserId } from "$lib/server/engineUser"
import { siteOrigin } from "$lib/server/origin"
import {
	relayRunning,
	rtcSettings,
	streamingAllowed,
} from "$lib/server/streaming"

// The Aya Player asks this before it joins a game, to set up Remote
// StreamingFrames (lib/server/streaming.ts). It sends the join script it was
// given, and gets the relay's address and the engine UserId it plays as, which
// decides the frames it may stream to. The session cookie says who's asking,
// as with the join script itself.

const noStore = { "Cache-Control": "no-store" }

export async function POST({ locals, request }) {
	if (!locals.user) error(401, "Not logged in")

	const body = await request.json().catch(() => null)
	let joinScript: URL
	try {
		joinScript = new URL(body?.joinScriptUrl, siteOrigin())
	} catch {
		error(400, "Invalid Request")
	}
	const placeId = joinScript.searchParams.get("placeId") ?? ""
	if (joinScript.pathname !== "/game/join/aya" || !/^\d{1,15}$/.test(placeId))
		error(400, "Invalid Request")

	if (!(await streamingAllowed(locals.user.id, +placeId)))
		error(403, "Press Play on the place page to join")

	const userId = engineUserId(locals.user.username)
	if (!relayRunning())
		return Response.json(
			{ userId, error: "StreamingFrames are turned off on this site" },
			{ headers: noStore }
		)

	const websocketUrl = new URL(
		`/streaming/ws?placeId=${placeId}`,
		siteOrigin()
	)
	websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:"
	return Response.json(
		{ userId, websocketUrl: websocketUrl.href, ...rtcSettings() },
		{ headers: noStore }
	)
}
