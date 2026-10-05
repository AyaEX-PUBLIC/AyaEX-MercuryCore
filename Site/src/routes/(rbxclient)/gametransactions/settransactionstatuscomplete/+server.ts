import { requireServerKey } from "$lib/server/assetAuth"
import { engineParams, json } from "$lib/server/engineParams"
import { completeReceipt } from "$lib/server/store"

// A gameserver's ProcessReceipt granted the purchase. (Caddy relabels this
// form-encoded POST, which has no Origin header, so SvelteKit's cross-site
// form check doesn't reject it; the server key authenticates it.)
export async function POST({ request, url }) {
	requireServerKey(request)
	const receipt = (await engineParams(request, url)).get("receipt")
	if (receipt) await completeReceipt(receipt)
	return json({ success: !!receipt })
}
