import { requireAssetAccess } from "$lib/server/assetAuth"
import { json } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { isFollowing } from "$lib/server/social"

// user/following-exists?userId=&followerUserId= (player dropdown)
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const [user, follower] = await Promise.all([
		userFromEngineId(Number(url.searchParams.get("userId"))),
		userFromEngineId(Number(url.searchParams.get("followerUserId"))),
	])
	return json({ success: true, isFollowing: !!user && !!follower && (await isFollowing(follower.id, user.id)) })
}
