import { error, fail } from "@sveltejs/kit"
import { bodyPartTypes } from "$lib/assetTypes"
import { brickColours } from "$lib/brickColours"
import { assetRegex } from "$lib/paramTests"
import { avatarRigs } from "$lib/rigTypes"
import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"
import ratelimit from "$lib/server/ratelimit"
import requestRender from "$lib/server/requestRender"
import { db, Record } from "$lib/server/surreal"
import type { RequestEvent } from "./$types.d"
import assetsQuery from "./assets.surql"
import equipQuery from "./equip.surql"
import equipDataQuery from "./equipData.surql"
import hatsEquippedQuery from "./hatsEquipped.surql"
import unequipQuery from "./unequip.surql"

// T-Shirts, Shirts, Pants, Faces and each body part slot: one at a time
// (plus Heads, Gear and Hats)
const oneEquippable = Object.freeze([2, 11, 12, 18, 27, 28, 29, 30, 31])
const allowedTypes = Object.freeze(oneEquippable.concat([8, 17, 19]))

// The item tabs and the types each lists; each is paged on its own (?tab=,
// kept in the URL by the page)
const tabTypes: { [tab: string]: readonly number[] } = Object.freeze({
	Recent: allowedTypes, // everything, newest first
	Hats: [8],
	Heads: [17],
	Faces: [18],
	"T-Shirts": [2],
	Shirts: [11],
	Pants: [12],
	"Body Parts": bodyPartTypes,
	Gear: [19],
})
const bodyParts = Object.freeze([
	"Head",
	"LeftArm",
	"LeftLeg",
	"RightArm",
	"RightLeg",
	"Torso",
])

export type Asset = {
	name: string
	price: number
	id: number
	type: number
	wearing: boolean
}

type AssetData = {
	id: number
	type: number
	visibility: string
}

export async function load({ locals, url }) {
	const { user } = await authorise(locals)
	const { page, checkPages } = pageQuery(url)

	const tab = url.searchParams.get("tab")
	const types = tabTypes[tab && Object.hasOwn(tabTypes, tab) ? tab : "Recent"]
	const [assets, pages] = await db.query<[Asset[], number]>(assetsQuery, {
		user: Record("user", user.id),
		types,
		page,
	})
	checkPages(pages)

	return { assets, pages, tabs: Object.keys(tabTypes) }
}

async function getEquipData(e: RequestEvent) {
	const { user } = await authorise(e.locals)
	const assetId = e.url.searchParams.get("id")

	if (!assetId) error(400, "Missing asset ID")
	if (!assetRegex.test(assetId)) error(400, `Invalid asset ID: ${assetId}`)
	const id = +assetId

	const limit = ratelimit(null, "equip", user.id, 2)
	if (limit) return { error: limit }

	const [[asset]] = await db.query<AssetData[][]>(equipDataQuery, {
		asset: Record("asset", id),
		user: Record("user", user.id),
	})
	if (!asset) error(404, "Item not found or not owned")
	if (!allowedTypes.includes(asset.type))
		error(400, "Can't equip this type of item")
	if (asset.visibility !== "Visible")
		error(400, "This item hasn't been approved yet")

	return { user, id, asset }
}

async function rerender(f: typeof globalThis.fetch, user: User) {
	try {
		await requestRender(f, "Avatar", user.id, user.username, true)
		return {
			avatar: `/api/avatar/${user.username}-body?r=${Math.random()}`,
		}
	} catch (e) {
		console.error(e)
		return fail(500, { msg: "Failed to request render" })
	}
}

async function paint({ fetch: f, locals, url }: RequestEvent) {
	const { user } = await authorise(locals)
	const bodyPartQuery = url.searchParams.get("p")
	const bodyColour = url.searchParams.get("c") as string

	if (
		!bodyPartQuery ||
		!bodyColour ||
		!(brickColours as readonly number[]).includes(+bodyColour) ||
		!bodyParts.includes(bodyPartQuery)
	)
		return fail(400)

	const bodyPart = bodyPartQuery as keyof typeof user.bodyColours
	const currentColours = user.bodyColours

	currentColours[bodyPart] = +bodyColour

	await db.update(Record("user", user.id)).merge({ bodyColours: currentColours })

	return await rerender(f, user)
}
async function regen({ fetch: f, locals }: RequestEvent) {
	const { user } = await authorise(locals)

	const limit = ratelimit(null, "regen", user.id, 2)
	if (limit) return limit

	return await rerender(f, user)
}
// the avatar type for places that let players choose (lib/rigTypes.ts)
async function rig({ fetch: f, locals, url }: RequestEvent) {
	const { user } = await authorise(locals)
	const avatarRig = url.searchParams.get("rig")
	if (!avatarRigs.includes(avatarRig as (typeof avatarRigs)[number]))
		return fail(400)

	const limit = ratelimit(null, "regen", user.id, 2)
	if (limit) return limit

	await db.update(Record("user", user.id)).merge({ avatarRig })
	return await rerender(f, user)
}
async function equip(e: RequestEvent) {
	const { user, id, asset, error } = await getEquipData(e)
	if (error) return error

	// Find if there's more than 3 hats equipped, throw an error if there is
	if (asset.type === 8) {
		const [hatsEquipped] = await db.query<number[]>(hatsEquippedQuery, {
			user: Record("user", user.id),
		})
		if (hatsEquipped >= 3)
			return fail(400, { msg: "You can only wear 3 hats" })
	}

	await db.query(equipQuery, {
		user: Record("user", user.id),
		asset: Record("asset", id),
		...(oneEquippable.includes(asset.type) ? asset : {}),
	})

	return await rerender(e.fetch, user)
}
async function unequip(e: RequestEvent) {
	const { user, id, error } = await getEquipData(e)
	if (error) return error

	await db.query(unequipQuery, {
		user: Record("user", user.id),
		asset: Record("asset", id),
	})

	return await rerender(e.fetch, user)
}
export const actions: import("./$types").Actions = {
	paint,
	regen,
	rig,
	equip,
	unequip,
}
