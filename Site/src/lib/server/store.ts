import fs from "node:fs"
import sharp from "sharp"
import { transact } from "$lib/server/economy"
import { engineUserId } from "$lib/server/engineUser"
import { db, Record } from "$lib/server/surreal"

// In-game store and badges for places, used by the place pages and by the
// endpoints the Aya engine calls (marketplace/*, gametransactions/*,
// game/gamepass/*, game/badge/*).
//
// - Game passes and badges are assets (types 34 and 21) with a `place`;
//   owning a pass is the usual ownsAsset relation, and the place's owner owns
//   all of its passes.
// - Developer products (devProduct) are bought repeatedly; each purchase leaves
//   a productReceipt until the gameserver has processed it.
// - Prices are whole currency units; the economy counts in micro-units.

export const GAME_PASS = 34
export const BADGE = 21
const UNIT = 1_000_000

type Owner = { id: string; username: string }

export type StoreItem = {
	id: number
	name: string
	description: string
	price: number
	forSale: boolean // on sale, or (badges) enabled
	type: number
	place: number
	placeName: string
	owner?: Owner
	created: number
	updated: number
	count: number // passes: owners, badges: times awarded
}

export type DevProduct = {
	id: number
	name: string
	description: string
	price: number
	forSale: boolean
	place: number
	placeName: string
	owner?: Owner
	created: number
	sales: number
}

const itemFields = `
	record::id(id) AS id,
	name,
	fn::currentContent($this.description) ?? "" AS description,
	price,
	forSale,
	type,
	record::id(place) AS place,
	place.name AS placeName,
	(SELECT record::id(id) AS id, username FROM $parent.place<-ownsPlace<-user)[0] AS owner,
	time::unix(created) AS created,
	time::unix(updated) AS updated,
	IF type = ${BADGE} { count(<-awardedBadge) } ELSE { count(<-ownsAsset) } AS count`

const productFields = `
	record::id(id) AS id,
	name,
	description,
	price,
	forSale,
	record::id(place) AS place,
	place.name AS placeName,
	(SELECT record::id(id) AS id, username FROM $parent.place<-ownsPlace<-user)[0] AS owner,
	time::unix(created) AS created,
	count(SELECT 1 FROM productReceipt WHERE product = $parent.id) AS sales`

/** A game pass or badge (or undefined), whatever the asset type requested. */
export async function storeItem(id: number, type: number) {
	const [[item]] = await db.query<[StoreItem[]]>(
		`SELECT ${itemFields} FROM type::record("asset", $id)
		WHERE type = $type AND visibility = "Visible" AND place != NONE`,
		{ id, type }
	)
	return item
}

export async function devProduct(id: number) {
	const [[product]] = await db.query<[DevProduct[]]>(
		`SELECT ${productFields} FROM type::record("devProduct", $id)`,
		{ id }
	)
	return product
}

/** A place's game passes and badges, with whether `user` owns/earned each. */
export async function placeItems(placeId: number, type: number, user?: string) {
	const [items] = await db.query<[(StoreItem & { owned: boolean })[]]>(
		`SELECT ${itemFields},
			IF $user {
				IF type = ${BADGE} { $user IN <-awardedBadge<-user }
				ELSE { $user IN <-ownsAsset<-user OR $user IN $this.place<-ownsPlace<-user }
			} ELSE { false } AS owned
		FROM asset WHERE place = $place AND type = $type AND visibility = "Visible"
		ORDER BY created`,
		{ place: Record("place", placeId), type, user: user ? Record("user", user) : undefined }
	)
	return items
}

export async function placeProducts(placeId: number) {
	const [products] = await db.query<[DevProduct[]]>(
		`SELECT ${productFields} FROM devProduct WHERE place = $place ORDER BY created`,
		{ place: Record("place", placeId) }
	)
	return products
}

export async function ownsGamePass(user: string, passId: number) {
	const [, owned] = await db.query<[unknown, boolean]>(
		`LET $pass = type::record("asset", $id);
		RETURN $pass.type = ${GAME_PASS} AND (
			$user IN $pass<-ownsAsset<-user OR $user IN $pass.place<-ownsPlace<-user
		);`,
		{ id: passId, user: Record("user", user) }
	)
	return owned === true
}

/** Whether `user` owns asset `assetId` (any asset: passes, catalog items...). */
export async function ownsAsset(user: string, assetId: number) {
	const [, owned] = await db.query<[unknown, boolean]>(
		`LET $asset = type::record("asset", $id);
		RETURN $user IN $asset<-ownsAsset<-user OR (
			$asset.type = ${GAME_PASS} AND $user IN $asset.place<-ownsPlace<-user
		);`,
		{ id: assetId, user: Record("user", user) }
	)
	return owned === true
}

// one purchase at a time per buyer, so double submits can't charge twice
const locks = new Map<string, Promise<unknown>>()
function withLock<T>(key: string, fn: () => Promise<T>) {
	const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn)
	locks.set(key, run)
	run.finally(() => locks.get(key) === run && locks.delete(key))
	return run
}

export type PurchaseResult = {
	success: boolean
	status: "Bought" | "AlreadyOwned" | "NotForSale" | "PriceChanged" | "InsufficientFunds" | "Failed"
	receipt?: string
}

async function charge(
	f: typeof globalThis.fetch,
	buyer: string,
	owner: Owner | undefined,
	price: number,
	note: string,
	link: string
): Promise<PurchaseResult | undefined> {
	if (price <= 0 || !owner || owner.id === buyer) return // free, or the owner's own item
	const tx = await transact(f, buyer, owner.id, price * UNIT, note, link, {})
	if (tx.ok) return
	console.error(`Store purchase failed (${buyer}): ${tx.msg}`)
	return {
		success: false,
		status: /insufficient|balance|not enough/i.test(tx.msg) ? "InsufficientFunds" : "Failed",
	}
}

export const buyGamePass = (
	f: typeof globalThis.fetch,
	buyer: string,
	passId: number,
	expectedPrice?: number
) =>
	withLock(buyer, async (): Promise<PurchaseResult> => {
		const pass = await storeItem(passId, GAME_PASS)
		if (!pass) return { success: false, status: "NotForSale" }
		if (await ownsGamePass(buyer, passId)) return { success: false, status: "AlreadyOwned" }
		if (!pass.forSale) return { success: false, status: "NotForSale" }
		if (expectedPrice !== undefined && expectedPrice !== pass.price)
			return { success: false, status: "PriceChanged" }

		const failed = await charge(
			f,
			buyer,
			pass.owner,
			pass.price,
			`Purchased game pass ${pass.name}`,
			`/place/${pass.place}`
		)
		if (failed) return failed

		await db.query("RELATE $user->ownsAsset->$asset", {
			user: Record("user", buyer),
			asset: Record("asset", passId),
		})
		return { success: true, status: "Bought" }
	})

export const buyDevProduct = (
	f: typeof globalThis.fetch,
	buyer: string,
	productId: number,
	expectedPrice: number | undefined,
	placeId: number | undefined,
	requestId: string
) =>
	withLock(buyer, async (): Promise<PurchaseResult> => {
		// the purchase prompt retries with the same requestId: don't charge twice
		const [[existing]] = await db.query<[{ id: string }[]]>(
			"SELECT record::id(id) AS id FROM productReceipt WHERE user = $user AND requestId = $requestId",
			{ user: Record("user", buyer), requestId }
		)
		if (existing) return { success: true, status: "Bought", receipt: existing.id }

		const product = await devProduct(productId)
		if (!product?.forSale || (placeId && product.place !== placeId))
			return { success: false, status: "NotForSale" }
		if (expectedPrice !== undefined && expectedPrice !== product.price)
			return { success: false, status: "PriceChanged" }

		const failed = await charge(
			f,
			buyer,
			product.owner,
			product.price,
			`Purchased developer product ${product.name}`,
			`/place/${product.place}`
		)
		if (failed) return failed

		const [receipt] = await db.query<[string]>(
			`(CREATE ONLY type::record("productReceipt", rand::id()) CONTENT {
				product: $product,
				user: $user,
				place: $place,
				price: $price,
				requestId: $requestId,
			} RETURN VALUE record::id(id))`,
			{
				product: Record("devProduct", productId),
				user: Record("user", buyer),
				place: Record("place", product.place),
				price: product.price,
				requestId,
			}
		)
		return { success: true, status: "Bought", receipt }
	})

export async function pendingReceipts(placeId: number, user: string) {
	const [receipts] = await db.query<[{ receipt: string; productId: number; price: number }[]]>(
		`SELECT record::id(id) AS receipt, record::id(product) AS productId, price, created
		FROM productReceipt
		WHERE place = $place AND user = $user AND completed = NONE
		ORDER BY created`,
		{ place: Record("place", placeId), user: Record("user", user) }
	)
	return receipts
}

export async function completeReceipt(receipt: string) {
	await db.query(
		'UPDATE type::record("productReceipt", $receipt) SET completed = time::now() WHERE completed = NONE',
		{ receipt }
	)
}

/** Awards a badge from a gameserver. Returns the message shown in game, or "0" if already earned. */
export async function awardBadge(user: { id: string; username: string }, badgeId: number, placeId: number) {
	const badge = await storeItem(badgeId, BADGE)
	if (!badge?.forSale || badge.place !== placeId) return "" // not this place's (enabled) badge
	const [[earned]] = await db.query<[unknown[]]>(
		"SELECT VALUE id FROM awardedBadge WHERE in = $user AND out = $badge",
		{ user: Record("user", user.id), badge: Record("asset", badgeId) }
	)
	if (earned) return "0"
	await db.query("RELATE $user->awardedBadge->$badge", {
		user: Record("user", user.id),
		badge: Record("asset", badgeId),
	})
	return `${user.username} won ${badge.placeName}'s "${badge.name}" award!`
}

export async function hasBadge(user: string, badgeId: number) {
	const [[earned]] = await db.query<[unknown[]]>(
		"SELECT VALUE id FROM awardedBadge WHERE in = $user AND out = $badge",
		{ user: Record("user", user), badge: Record("asset", badgeId) }
	)
	return !!earned
}

export type EarnedBadge = {
	id: number
	name: string
	description: string
	place: number
	placeName: string
	awarded: number
}

/** Badges a user has earned, newest first. */
export async function userBadges(user: string) {
	const [badges] = await db.query<[EarnedBadge[]]>(
		`SELECT
			record::id(out) AS id,
			out.name AS name,
			fn::currentContent(out.description) ?? "" AS description,
			record::id(out.place) AS place,
			out.place.name AS placeName,
			time::unix(time) AS awarded
		FROM awardedBadge WHERE in = $user AND out.visibility = "Visible"
		ORDER BY awarded DESC`,
		{ user: Record("user", user) }
	)
	return badges
}

// --- creation and editing (place settings) ---

async function saveIcon(id: number, icon?: File) {
	if (!icon || icon.size === 0) return
	fs.mkdirSync("../data/thumbnails", { recursive: true })
	await sharp(await icon.arrayBuffer())
		.resize(420, 420, { fit: "cover" })
		.png()
		.toFile(`../data/thumbnails/${id}`)
}

export async function createStoreItem(
	placeId: number,
	owner: string,
	type: typeof GAME_PASS | typeof BADGE,
	item: { name: string; description: string; price: number; icon?: File }
) {
	const [, , id] = await db.query<[unknown, unknown, number]>(
		`LET $asset = (CREATE ONLY asset CONTENT {
			id: fn::assetId(),
			name: $name,
			description: [{ text: $description }],
			price: $price,
			type: $type,
			visibility: "Visible",
			place: $place,
		} RETURN VALUE id);
		RELATE $owner->created->$asset;
		RETURN record::id($asset);`,
		{
			name: item.name,
			description: item.description,
			price: type === BADGE ? 0 : item.price,
			type,
			place: Record("place", placeId),
			owner: Record("user", owner),
		}
	)
	await saveIcon(id, item.icon)
	return id
}

export async function createDevProduct(
	placeId: number,
	item: { name: string; description: string; price: number }
) {
	const [id] = await db.query<[number]>(
		`RETURN (CREATE ONLY type::record("devProduct", fn::assetId()) CONTENT {
			place: $place,
			name: $name,
			description: $description,
			price: $price,
		} RETURN VALUE record::id(id));`,
		{ place: Record("place", placeId), ...item }
	)
	return id
}

/** Changes the price / on-sale (or enabled) state of one of a place's items. */
export async function updateStoreItem(
	placeId: number,
	kind: "asset" | "devProduct",
	id: number,
	changes: { price?: number; forSale?: boolean }
) {
	await db.query(
		`UPDATE type::record($kind, $id) MERGE $changes WHERE place = $place`,
		{ kind, id, place: Record("place", placeId), changes }
	)
}

/** Info in the shape MarketplaceService:GetProductInfo expects. */
export function productInfo(item: {
	assetId: number
	productId: number
	name: string
	description: string
	price: number
	forSale: boolean
	assetTypeId: number
	owner?: Owner
	created?: number
	updated?: number
	productType: "User Product" | "Developer Product"
}) {
	const time = (unix?: number) => new Date((unix ?? 0) * 1000).toISOString()
	return {
		TargetId: item.productType === "Developer Product" ? item.productId : item.assetId,
		ProductType: item.productType,
		AssetId: item.assetId,
		ProductId: item.productId,
		Name: item.name,
		Description: item.description,
		AssetTypeId: item.assetTypeId,
		Creator: {
			Id: item.owner ? engineUserId(item.owner.username) : 0,
			Name: item.owner?.username ?? "",
			CreatorType: "User",
			CreatorTargetId: item.owner ? engineUserId(item.owner.username) : 0,
		},
		IconImageAssetId: 0,
		Created: time(item.created),
		Updated: time(item.updated ?? item.created),
		PriceInRobux: item.price,
		PriceInTickets: null,
		IsForSale: item.forSale,
		IsPublicDomain: item.forSale && item.price === 0,
		IsLimited: false,
		IsLimitedUnique: false,
		Remaining: null,
		Sales: 0,
		MinimumMembershipLevel: 0,
		ContentRatingTypeId: 0,
	}
}
