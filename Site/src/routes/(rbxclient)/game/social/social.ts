import { error } from "@sveltejs/kit"
import { engineParams } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"

/** The two players (engine user IDs) a FriendService request is about */
export async function enginePair(request: Request, url: URL) {
	const params = await engineParams(request, url)
	const [user, other] = await Promise.all([
		userFromEngineId(params.int("userId", "firstUserId") ?? 0),
		userFromEngineId(params.int("otherUserId", "secondUserId") ?? 0),
	])
	if (!user || !other) error(404, "User not found")
	return { user, other }
}
