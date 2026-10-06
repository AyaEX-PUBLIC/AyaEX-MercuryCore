import { requireAssetAccess } from "$lib/server/assetAuth"
import { json } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { friendCount } from "$lib/server/social"

// user/get-friendship-count[?userId=] (checked before sending a friend
// request in game); without userId, the logged-in player's count
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const param = url.searchParams.get("userId")
	const user = param ? (await userFromEngineId(Number(param)))?.id : locals.user?.id
	return json({ success: true, count: user ? await friendCount(user) : 0 })
}
