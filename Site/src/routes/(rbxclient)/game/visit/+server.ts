import { engineUserId } from "$lib/server/engineUser"
import { siteOrigin } from "$lib/server/origin"
import { SignAyaScript, SignScript } from "$lib/server/sign"

// Play solo: Studio loads this (as /Game/Visit.ashx?IsPlaySolo=1&placeId=...)
// to start a playtest with a local player. Aya's Studio runs on the Site's
// origin, so its request carries the session: the player has the signed-in
// user's UserId and avatar.

const lua = (text: string) => `"${text.replace(/[\\"]/g, "\\$&").replace(/[\r\n]/g, " ")}"`

export async function GET({ locals, request, url }) {
	const placeId = url.searchParams.get("placeId") ?? url.searchParams.get("PlaceID") ?? ""
	const origin = siteOrigin()
	const user = locals.user
	const script = (await Bun.file("../data/server/loadscripts/visit.lua").text())
		.replaceAll("_PLACE_ID", /^\d{1,15}$/.test(placeId) ? placeId : "0")
		.replaceAll("_USER_ID", user ? String(engineUserId(user.username)) : "0")
		.replaceAll(
			"_CHARACTER_APPEARANCE",
			lua(user ? `${origin}/asset/characterfetch/${user.username}` : "")
		)
		.replaceAll("_BASE_URL", lua(origin))

	// Aya only runs loadfile scripts with its own signature header; native
	// Roblox clients (Roblox/WinInet) want theirs
	const native = request.headers.get("user-agent")?.startsWith("Roblox/")
	return new Response(native ? await SignScript(script) : await SignAyaScript(script), {
		headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
	})
}
