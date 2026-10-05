import { requireAssetAccess } from "$lib/server/assetAuth"
import { json } from "$lib/server/engineParams"

// checked by the purchase prompt before buying anything
export function GET({ locals, request }) {
	requireAssetAccess(locals, request)
	return json({ isMarketplaceEnabled: true })
}
