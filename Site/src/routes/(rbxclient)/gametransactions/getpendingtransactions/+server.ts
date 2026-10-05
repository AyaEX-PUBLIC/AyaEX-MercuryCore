import { requireServerKey } from "$lib/server/assetAuth"
import { engineParams, json } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { pendingReceipts } from "$lib/server/store"

// Polled by gameservers: developer product purchases for MarketplaceService.ProcessReceipt
export async function GET({ request, url }) {
	requireServerKey(request)
	const params = await engineParams(request, url)
	const placeId = params.int("PlaceId")
	const playerId = params.int("PlayerId")
	const user = playerId ? await userFromEngineId(playerId) : undefined
	if (!placeId || !playerId || !user) return json([])

	const receipts = await pendingReceipts(placeId, user.id)
	return json(
		receipts.map(r => ({
			playerId,
			placeId,
			receipt: r.receipt,
			actionArgs: [
				{ Key: "productId", Value: String(r.productId) },
				{ Key: "currencyTypeId", Value: "1" },
				{ Key: "unitPrice", Value: String(r.price) },
			],
		}))
	)
}
