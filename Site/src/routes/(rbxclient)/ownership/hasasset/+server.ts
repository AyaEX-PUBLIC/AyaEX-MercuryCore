import { mayAskAbout, requireAssetAccess } from "$lib/server/assetAuth"
import { engineParams, text } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { ownsAsset } from "$lib/server/store"

// MarketplaceService:PlayerOwnsAsset and the purchase prompt
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const params = await engineParams(request, url)
	const user = await userFromEngineId(params.int("userId") ?? 0)
	const assetId = params.int("assetId")
	// the purchase prompt asks about the signed-in player; a gameserver (the
	// server key) asks about any player
	if (!mayAskAbout(locals, request, user?.id)) return text("false")
	return text(user && assetId && (await ownsAsset(user.id, assetId)) ? "true" : "false")
}
