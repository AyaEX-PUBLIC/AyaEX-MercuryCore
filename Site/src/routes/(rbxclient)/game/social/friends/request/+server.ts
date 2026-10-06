import { requireServerKey } from "$lib/server/assetAuth"
import { text } from "$lib/server/engineParams"
import { requestFriendship } from "$lib/server/social"
import { enginePair } from "../../social"

// FriendService: a friend request sent in game, or an accept (the engine sends the request back)
export async function POST({ request, url }) {
	requireServerKey(request)
	const { user, other } = await enginePair(request, url)
	await requestFriendship(user, other)
	return text("")
}
