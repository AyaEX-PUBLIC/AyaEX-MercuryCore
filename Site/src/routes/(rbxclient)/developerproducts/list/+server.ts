import { requireAssetAccess } from "$lib/server/assetAuth"
import { engineParams, json } from "$lib/server/engineParams"
import { placeProducts } from "$lib/server/store"

// MarketplaceService:GetDeveloperProductsAsync (one page with everything)
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const placeId = (await engineParams(request, url)).int("placeid", "placeId")
	const products = placeId ? await placeProducts(placeId) : []
	return json({
		DeveloperProducts: products
			.filter(p => p.forSale)
			.map(p => ({
				ProductId: p.id,
				DeveloperProductId: p.id,
				Name: p.name,
				Description: p.description,
				PriceInRobux: p.price,
				IconImageAssetId: 0,
			})),
		FinalPage: true,
		PageSize: products.length,
	})
}
