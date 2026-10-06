import { requireAssetAccess } from "$lib/server/assetAuth"
import { userFromEngineId } from "$lib/server/engineUser"
import { groupFromEngineId, groupRank, roleName } from "$lib/server/groups"
import { areFriends } from "$lib/server/social"

// SocialService (/Game/LuaWebService/HandleSocialRequest.ashx, see
// Caddyfile.aya): Player:IsFriendsWith when the other player isn't in the
// server, and Player:IsInGroup/GetRankInGroup/GetRoleInGroup with the group
// IDs from lib/server/groups.ts (the player list's admin icon uses these).
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
		case "getgrouprank":
		case "getgrouprole": {
			const group = await groupFromEngineId(Number(url.searchParams.get("groupid")))
			const rank = player && group ? await groupRank(player.id, group.id) : 0
			if (method === "isingroup") return value("boolean", rank > 0)
			if (method === "getgrouprank") return value("integer", rank)
			return value("string", roleName(rank))
		}
	}
	return value("boolean", false)
}
