import { requireServerKey } from "$lib/server/assetAuth"
import { text } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { friendsAmong } from "$lib/server/social"

// FriendService bulk friend check, when a player joins: which of the players
// already in the server (otherUserIds) they're friends with, as ",id,id,"
export async function GET({ request, url }) {
	requireServerKey(request)
	const user = await userFromEngineId(Number(url.searchParams.get("userId")))
	if (!user) return text("")
	const others = new Map<string, number>()
	for (const value of url.searchParams.getAll("otherUserIds")) {
		const engineId = Number(value)
		const other = await userFromEngineId(engineId)
		if (other) others.set(other.id, engineId)
	}
	const friends = await friendsAmong(user.id, [...others.keys()])
	return text(friends.length ? `,${friends.map(id => others.get(id)).join(",")},` : "")
}
