import { requireServerKey } from "$lib/server/assetAuth"
import { text } from "$lib/server/engineParams"
import { deleteFriendRequests } from "$lib/server/social"
import { enginePair } from "../../social"

// FriendService: a friend request revoked or declined in game
export async function POST({ request, url }) {
	requireServerKey(request)
	const { user, other } = await enginePair(request, url)
	await deleteFriendRequests(user, other)
	return text("")
}
