import { error } from "@sveltejs/kit"
import { engineUserId } from "$lib/server/engineUser"
import { siteOrigin } from "$lib/server/origin"
import { SignData } from "$lib/server/sign"
import { db, Record, type RecordId } from "$lib/server/surreal"
import joinQuery from "../join.surql"
import latestPlayingQuery from "./latestPlaying.surql"

// Join configuration for the Aya WebAssembly Player. Gameservers are native
// Aya.Server processes reached over a WebSocket, proxied by the Orbiter at
// /gameserver/{placeId} on the Site's own origin.
//
// The Player runs on the Site's origin, so its request carries the user's
// session cookie: no ticket appears in any URL. The user must have pressed
// Play for the place (which also checks private server access) recently.

type Session = {
	place: {
		id: number
		ownerUser: {
			username: string
		}
	}
	user: {
		permissionLevel: number
		username: string
	}
}


function gameserverAddress(placeId: number) {
	const url = new URL(`/gameserver/${placeId}`, siteOrigin())
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
	const port = +url.port || (url.protocol === "wss:" ? 443 : 80)
	return { address: url.href, port }
}

export async function GET({ locals, url }) {
	if (!locals.user) error(401, "Not logged in")

	const placeId = url.searchParams.get("placeId")
	if (!placeId || !/^\d+$/.test(placeId)) error(400, "Invalid Request")

	const [, playing] = await db.query<(RecordId<"playing"> | undefined)[]>(
		latestPlayingQuery,
		{ user: Record("user", locals.user.id), place: Record("place", +placeId) }
	)
	if (!playing) error(403, "Press Play on the place page to join")

	const [gameSession] = await db.query<Session[]>(joinQuery, { playing })
	if (!gameSession) error(400, "Invalid Game Session")

	const { place, user } = gameSession
	const origin = siteOrigin()
	const server = gameserverAddress(place.id)

	const joinconfig = {
		ClientPort: 0,
		MachineAddress: server.address,
		ServerPort: server.port,
		UserName: user.username,
		DisplayName: user.username,
		UserId: engineUserId(user.username),
		CharacterAppearance: `${origin}/asset/characterfetch/${user.username}`,
		// presence is reported by the gameserver (see /game/serverpresence)
		PingUrl: "",
		PingInterval: 0,
		GameId: "00000000-0000-0000-0000-000000000000",
		PlaceId: place.id,
		UniverseId: place.id,
		CreatorId: 0,
		CreatorTypeEnum: "User",
		MembershipType: "None",
		AccountAge: 0,
		SuperSafeChat: false,
		IsUnknownOrUnder13: false,
		ChatStyle: "ClassicAndBubble",
		VirtualVersion: 0, // 2016
		IsRobloxPlace: false,
		BaseUrl: `${origin}/`,
		ClientTicket: "",
		SessionId: "",
		BrowserTrackerId: "",
		FollowUserId: 0,
		CookieStoreEnabled: false,
		CookieStoreFirstTimePlayKey: "",
		CookieStoreFiveMinutePlayKey: "",
		ScreenShotInfo: "",
		VideoInfo: "",
	}

	return new Response(await SignData(JSON.stringify(joinconfig)), {
		headers: { "Cache-Control": "no-store" },
	})
}
