import { requireAssetAccess } from "$lib/server/assetAuth"
import { engineParams } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { ownsGamePass } from "$lib/server/store"

// GamePassService:PlayerHasPass (Caddy maps GamePassHandler.ashx here)
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const params = await engineParams(request, url)
	const user = await userFromEngineId(params.int("UserID", "userId") ?? 0)
	const passId = params.int("PassID", "passId")
	const owns = !!user && !!passId && (await ownsGamePass(user.id, passId))
	return new Response(`<Value Type="boolean">${owns}</Value>`, {
		headers: { "Content-Type": "application/xml", "Cache-Control": "no-store" },
	})
}
