import { requireAssetAccess } from "$lib/server/assetAuth"
import { engineParams, json } from "$lib/server/engineParams"
import { devProduct, productInfo } from "$lib/server/store"

// MarketplaceService:GetProductInfo(productId, Enum.InfoType.Product)
export async function GET({ locals, request, url }) {
	requireAssetAccess(locals, request)
	const productId = (await engineParams(request, url)).int("productId")
	const product = productId ? await devProduct(productId) : undefined
	if (!product || !productId) return json({ error: "Product not found" }, 404)

	return json(
		productInfo({
			assetId: 0,
			productId,
			name: product.name,
			description: product.description,
			price: product.price,
			forSale: product.forSale,
			assetTypeId: 0,
			owner: product.owner,
			created: product.created,
			productType: "Developer Product",
		})
	)
}
