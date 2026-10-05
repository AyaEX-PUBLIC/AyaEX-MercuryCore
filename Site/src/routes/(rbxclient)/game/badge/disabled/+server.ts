import { requireServerKey } from "$lib/server/assetAuth"
import { engineParams, text } from "$lib/server/engineParams"
import { BADGE, storeItem } from "$lib/server/store"

// BadgeService:IsDisabled: "1" if the badge is disabled or doesn't exist
export async function GET({ request, url }) {
	requireServerKey(request)
	const badgeId = (await engineParams(request, url)).int("badgeId")
	const badge = badgeId ? await storeItem(badgeId, BADGE) : undefined
	return text(badge?.forSale ? "0" : "1")
}
