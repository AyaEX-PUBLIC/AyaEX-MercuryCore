import { requireServerKey } from "$lib/server/assetAuth"
import { engineParams, text } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { hasBadge } from "$lib/server/store"

// BadgeService:UserHasBadge
export async function GET({ request, url }) {
	requireServerKey(request)
	const params = await engineParams(request, url)
	const user = await userFromEngineId(params.int("userId") ?? 0)
	const badgeId = params.int("badgeId")
	return text(user && badgeId && (await hasBadge(user.id, badgeId)) ? "Success" : "Failure")
}
