import { engineParams, json } from "$lib/server/engineParams"
import { buyGamePass } from "$lib/server/store"

// The in-game purchase prompt (in the player's browser) buying a game pass.
// The buyer is the logged-in user, never a userId from the request.
export async function POST({ fetch: f, locals, request, url }) {
	if (!locals.user) return json({ success: false, status: "Unauthorized" }, 401)
	const params = await engineParams(request, url)
	const productId = params.int("productId")
	if (!productId) return json({ success: false, status: "InvalidProduct" }, 400)

	const result = await buyGamePass(f, locals.user.id, productId, params.int("purchasePrice"))
	console.log(`Game pass ${productId} purchase by ${locals.user.username}: ${result.status}`)
	return json(result)
}
