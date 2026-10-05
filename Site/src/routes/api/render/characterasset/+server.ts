import { error } from "@sveltejs/kit"
import { assetRegex } from "$lib/paramTests"
import config from "$lib/server/config"
import { requireAssetAccess } from "$lib/server/assetAuth"

export async function GET({ url, locals, request }) {
	requireAssetAccess(locals, request)

	const id = url.searchParams.get("id")
	if (!id || !assetRegex.test(id)) error(400, "Missing id parameter")

	const res = `http://${config.Domain}/api/render/character;http://${config.Domain}/asset?id=${id}`
	return new Response(res, {
		headers: {
			Pragma: "no-cache",
			"Cache-Control": "no-cache",
		},
	})
}
