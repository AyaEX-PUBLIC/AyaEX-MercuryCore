import { requireServerKey } from "$lib/server/assetAuth"
import { engineParams, text } from "$lib/server/engineParams"
import { BADGE, storeItem } from "$lib/server/store"

// BadgeService:IsLegal: "1" if the badge belongs to this place
export async function GET({ request, url }) {
	requireServerKey(request)
	const params = await engineParams(request, url)
	const badgeId = params.int("badgeId")
	const placeId = params.int("placeId")
	const badge = badgeId ? await storeItem(badgeId, BADGE) : undefined
	return text(badge && badge.place === placeId ? "1" : "0")
}
