import { requireServerKey } from "$lib/server/assetAuth"
import { text } from "$lib/server/engineParams"
import { makeFriends } from "$lib/server/social"
import { enginePair } from "../../social"

// FriendService: both players asked to be friends in game
export async function POST({ request, url }) {
	requireServerKey(request)
	const { user, other } = await enginePair(request, url)
	await makeFriends(user, other)
	return text("")
}
