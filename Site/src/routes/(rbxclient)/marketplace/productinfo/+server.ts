import { requireAssetAccess } from "$lib/server/assetAuth"
import { engineParams, json } from "$lib/server/engineParams"
import { GAME_PASS, productInfo, storeItem } from "$lib/server/store"
import { db, Record } from "$lib/server/surreal"

type Asset = {
	name: string
	description: string
	price: number
	type: number
	created: number
	updated: number
	owner?: { id: string; username: string }
}

// MarketplaceService:GetProductInfo(assetId): game passes are sold in game;
// other assets are described but not sold in game (they're in the catalog)
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const assetId = (await engineParams(request, url)).int("assetId")
	if (!assetId) return json({ error: "Invalid assetId" }, 400)

	const pass = await storeItem(assetId, GAME_PASS)
	if (pass)
		return json(
			productInfo({
				assetId,
				productId: assetId,
				name: pass.name,
				description: pass.description,
				price: pass.price,
				forSale: pass.forSale,
				assetTypeId: GAME_PASS,
				owner: pass.owner,
				created: pass.created,
				updated: pass.updated,
				productType: "User Product",
			})
		)

	const [[asset]] = await db.query<[Asset[]]>(
		`SELECT name, fn::currentContent($this.description) ?? "" AS description, price, type,
			time::unix(created) AS created, time::unix(updated) AS updated,
			(SELECT record::id(id) AS id, username FROM $parent<-created<-user)[0] AS owner
		FROM $asset WHERE visibility = "Visible"`,
		{ asset: Record("asset", assetId) }
	)
	return json(
		productInfo({
			assetId,
			productId: assetId,
			name: asset?.name ?? `Asset ${assetId}`,
			description: asset?.description ?? "",
			price: asset?.price ?? 0,
			forSale: false,
			assetTypeId: asset?.type ?? 0,
			owner: asset?.owner,
			created: asset?.created,
			updated: asset?.updated,
			productType: "User Product",
		})
	)
}
