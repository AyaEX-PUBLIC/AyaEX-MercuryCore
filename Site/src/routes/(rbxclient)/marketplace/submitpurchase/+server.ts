import { engineParams, json } from "$lib/server/engineParams"
import { buyDevProduct } from "$lib/server/store"

// The in-game purchase prompt buying a developer product. Retries reuse the
// same requestId, which makes this idempotent.
export async function POST({ fetch: f, locals, request, url }) {
	if (!locals.user) return json({ success: false, status: "Unauthorized" }, 401)
	const params = await engineParams(request, url)
	const productId = params.int("productId")
	const requestId = params.get("requestId")
	if (!productId || !requestId || requestId.length > 100)
		return json({ success: false, status: "InvalidProduct" }, 400)

	const result = await buyDevProduct(
		f,
		locals.user.id,
		productId,
		params.int("expectedUnitPrice"),
		params.int("placeId"),
		requestId
	)
	console.log(`Developer product ${productId} purchase by ${locals.user.username}: ${result.status}`)
	return json(result)
}
