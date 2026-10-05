import { requireServerKey } from "$lib/server/assetAuth"
import { engineParams, text } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { awardBadge } from "$lib/server/store"

// BadgeService:AwardBadge from a gameserver. Only the badge's own place can
// award it. Returns the in-game message, "0" if already earned, "" on failure.
export async function POST({ request, url }) {
	requireServerKey(request)
	const params = await engineParams(request, url)
	const user = await userFromEngineId(params.int("userId") ?? 0)
	const badgeId = params.int("badgeId")
	const placeId = params.int("placeId")
	if (!user || !badgeId || !placeId) return text("")
	const result = await awardBadge(user, badgeId, placeId)
	if (result && result !== "0") console.log(`Badge ${badgeId} awarded to ${user.username} in place ${placeId}`)
	return text(result)
}
