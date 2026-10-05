import { hasServerKey } from "$lib/server/assetAuth"
import { engineParams, json } from "$lib/server/engineParams"
import { engineUserId } from "$lib/server/engineUser"
import { db } from "$lib/server/surreal"

type Receipt = { username: string; placeId: number; productId: number }

// lets a gameserver check that a receipt is real
export async function POST({ locals, request, url }) {
	if (!locals.user && !hasServerKey(request)) return json({ isValid: false }, 401)
	const receipt = (await engineParams(request, url)).get("receipt") ?? ""
	const [[found]] = await db.query<[Receipt[]]>(
		`SELECT user.username AS username, record::id(place) AS placeId, record::id(product) AS productId
		FROM type::record("productReceipt", $receipt)`,
		{ receipt }
	)
	if (!found) return json({ isValid: false, receipt })
	return json({
		isValid: true,
		receipt,
		playerId: engineUserId(found.username),
		placeId: found.placeId,
		productId: found.productId,
	})
}
