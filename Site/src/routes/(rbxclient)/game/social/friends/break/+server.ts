import { requireServerKey } from "$lib/server/assetAuth"
import { text } from "$lib/server/engineParams"
import { breakFriendship } from "$lib/server/social"
import { enginePair } from "../../social"

// FriendService: unfriended in game
export async function POST({ request, url }) {
	requireServerKey(request)
	const { user, other } = await enginePair(request, url)
	await breakFriendship(user, other)
	return text("")
}
