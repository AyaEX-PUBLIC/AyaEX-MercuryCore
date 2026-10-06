import { requireAssetAccess } from "$lib/server/assetAuth"
import { userFromEngineId } from "$lib/server/engineUser"
import { areFriends } from "$lib/server/social"

// SocialService (/Game/LuaWebService/HandleSocialRequest.ashx, see
// Caddyfile.aya): Player:IsFriendsWith when the other player isn't in the
// server. Groups aren't linked to the engine, so group checks say no.
const value = (type: string, v: string | number | boolean) =>
	new Response(`<Value Type="${type}">${v}</Value>`, {
		headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" },
	})

export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const method = url.searchParams.get("method")?.toLowerCase()
	const player = await userFromEngineId(Number(url.searchParams.get("playerid")))

	switch (method) {
		case "isfriendswith":
		case "isbestfriendswith": {
			const other = await userFromEngineId(Number(url.searchParams.get("userid")))
			return value("boolean", !!player && !!other && (await areFriends(player, other)))
		}
		case "isingroup":
			return value("boolean", false)
		case "getgrouprank":
			return value("integer", 0)
		case "getgrouprole":
			return value("string", "Guest")
	}
	return value("boolean", false)
}
