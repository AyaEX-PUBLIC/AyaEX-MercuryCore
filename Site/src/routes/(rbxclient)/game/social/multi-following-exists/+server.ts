import { requireAssetAccess } from "$lib/server/assetAuth"
import { json } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { isFollowing } from "$lib/server/social"

// user/multi-following-exists (ServerSocialScript, when a player joins): who
// follows whom between the new player and everyone in the server
export async function POST({ locals, request }) {
	requireAssetAccess(locals, request)
	const body = await request.json().catch(() => ({}))
	const userId = Number(body.userId)
	const user = await userFromEngineId(userId)
	const others: unknown[] = Array.isArray(body.otherUserIds) ? body.otherUserIds.slice(0, 200) : []

	const FollowingDetails = []
	for (const value of others) {
		const otherId = Number(value)
		const other = await userFromEngineId(otherId)
		if (!user || !other || other.id === user.id) continue
		const [user1FollowsUser2, user2FollowsUser1] = await Promise.all([
			isFollowing(user.id, other.id),
			isFollowing(other.id, user.id),
		])
		FollowingDetails.push({
			UserId1: userId,
			UserId2: otherId,
			User1FollowsUser2: user1FollowsUser2,
			User2FollowsUser1: user2FollowsUser1,
		})
	}
	return json({ success: true, FollowingDetails })
}
