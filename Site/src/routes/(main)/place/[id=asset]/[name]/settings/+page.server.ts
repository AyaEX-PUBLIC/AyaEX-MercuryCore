import fs from "node:fs"
import { error, fail } from "@sveltejs/kit"
import { type } from "arktype"
import sharp from "sharp"
import { placeRigTypes } from "$lib/rigTypes"
import { authorise } from "$lib/server/auth"
import filter from "$lib/server/filter"
import formError from "$lib/server/formError"
import { closeGameserver } from "$lib/server/orbiter"
import {
	lockedClientVersion,
	maxPlaceFileSize,
	setPlacePrivacy,
	writePlaceFile,
} from "$lib/server/places"
import {
	BADGE,
	createDevProduct,
	createStoreItem,
	GAME_PASS,
	placeItems,
	placeProducts,
	updateStoreItem,
} from "$lib/server/store"
import { db, Record } from "$lib/server/surreal"
import updatePlaceViewQuery from "$lib/server/updatePlaceView.surql"
import { arktype, message, superValidate } from "$lib/server/validate"
import {
	maxPlayersTest,
	serverAddressTest,
	serverPortTest,
} from "$lib/typeTests"
import { encode } from "$lib/urlName"
import type { RequestEvent } from "./$types.d"
import privateTicketQuery from "./privateTicket.surql"
import serverTicketQuery from "./serverTicket.surql"
import settingsQuery from "./settings.surql"

const viewSchema = type({
	name: "string <= 100",
	icon: "(File | undefined)?",
	thumbnail: "(File | undefined)?",
	description: "(string <= 1000) | undefined",
})
const networkSchema = type({
	dedicated: "boolean",
	serverAddress: serverAddressTest.optional(),
	serverPort: serverPortTest.optional(),
	maxPlayers: maxPlayersTest,
})
const ticketSchema = type({} as never) // I'm a genius
const privacySchema = type({
	privateServer: "boolean",
})
const avatarSchema = type({
	rigType: type.enumerated(...placeRigTypes),
})
const privatelinkSchema = type({} as never)
const dataSchema = type({
	file: "File",
})

type Place = {
	created: string
	dedicated: boolean
	description: string
	id: string // graah
	maxPlayers: number
	name: string
	owner: BasicUser
	privateServer: boolean
	privateTicket: string
	rigType: (typeof placeRigTypes)[number]
	clientVersion: number
	serverAddress: string
	serverPing: number
	serverPort: number
	serverTicket: string
	updated: Date
}

async function placeQuery(id: number) {
	const [[place]] = await db.query<Place[][]>(settingsQuery, {
		place: Record("place", id),
	})
	return place
}

export async function load({ locals, params }) {
	const getPlace = await placeQuery(+params.id)
	if (!getPlace) error(404, "Place not found")

	const { user } = await authorise(locals)
	if (user.username !== getPlace.owner.username && user.permissionLevel < 4)
		error(403, "You do not have permission to view this page.")

	return {
		...getPlace,
		slug: encode(getPlace.name),
		viewForm: await superValidate(
			{ name: getPlace.name },
			arktype(viewSchema)
		),
		networkForm: await superValidate(arktype(networkSchema)),
		ticketForm: await superValidate(arktype(ticketSchema)), // lmaooo it works
		avatarForm: await superValidate(
			{ rigType: getPlace.rigType },
			arktype(avatarSchema)
		),
		privacyForm: await superValidate(arktype(privacySchema)),
		privatelinkForm: await superValidate(arktype(privatelinkSchema)),
		dataForm: await superValidate(arktype(dataSchema)),
		gamePasses: await placeItems(+params.id, GAME_PASS),
		devProducts: await placeProducts(+params.id),
		badges: await placeItems(+params.id, BADGE),
	}
}

async function getData({ locals, params }: RequestEvent) {
	const { user } = await authorise(locals)
	const id = +params.id
	const getPlace = await placeQuery(id)
	if (user.username !== getPlace.owner.username && user.permissionLevel < 4)
		error(403, "You do not have permission to update this page.")

	return id
}

export const actions: import("./$types").Actions = {}
actions.view = async e => {
	const id = await getData(e)

	const formData = await e.request.formData()
	const form = await superValidate(formData, arktype(viewSchema))
	if (!form.valid) return formError(form)

	const { name, icon, thumbnail, description } = form.data
	form.data.icon = undefined // make sure files don't get returned (they can't be serialised)
	form.data.thumbnail = undefined

	if (icon && icon.size > 0) {
		if (icon.size > 1e6)
			return formError(
				form,
				["icon"],
				["Icon must be less than 1MB in size"]
			)

		if (!fs.existsSync("../data/icons")) fs.mkdirSync("../data/icons")
		sharp(await icon.arrayBuffer())
			.resize(270, 270)
			.avif({ effort: 9 }) // not awaited, so this'll happen in the background (takes a sec or 2)
			.toFile(`../data/icons/${id}.avif`) // also errors aren't caught but whatever
	}

	if (thumbnail && thumbnail.size > 0) {
		if (thumbnail.size > 5e6)
			return formError(
				form,
				["thumbnail"],
				["Thumbnail must be less than 5MB in size"]
			)

		// shown in the place page's 16:9 carousel; awaited so the new
		// thumbnail is there when the page reloads
		fs.mkdirSync("../data/placethumbnails", { recursive: true })
		try {
			await sharp(await thumbnail.arrayBuffer())
				.resize(1280, 720, { fit: "cover" })
				.avif({ effort: 4 })
				.toFile(`../data/placethumbnails/${id}.avif`)
		} catch {
			return formError(
				form,
				["thumbnail"],
				["Thumbnail must be a valid image"]
			)
		}
	}

	await db.query(updatePlaceViewQuery, {
		place: Record("place", +id),
		name: filter(name),
		description: filter(description || ""),
	})
	return message(form, "View settings updated successfully!")
}
actions.ticket = async e => {
	const id = await getData(e)

	await db.query(serverTicketQuery, { place: Record("place", id) })
	return message(
		await superValidate(e.request, arktype(ticketSchema)),
		"Regenerated!"
	)
}
actions.network = async e => {
	const id = await getData(e)
	const form = await superValidate(e.request, arktype(networkSchema))
	if (!form.valid) return formError(form)

	// only administrators can see or change the selfhosted server address
	const { user } = await authorise(e.locals)
	const { serverAddress, serverPort, ...settings } = form.data
	await db
		.update(Record("place", id))
		.merge(
			user.permissionLevel >= 5
				? { ...settings, serverAddress, serverPort, clientVersion: lockedClientVersion }
				: { ...settings, clientVersion: lockedClientVersion }
		)

	// engine / port settings changed, so any running server for this place is now
	// invalid (wrong 2013/2016 flow, wrong bind port etc.) - shut it down
	const res = await closeGameserver(e.fetch, id)
	if (!res.ok) console.error("Failed to close active server for place", id, res.msg)

	return message(form, "Network settings updated successfully!")
}
actions.privacy = async e => {
	const id = await getData(e)
	const form = await superValidate(e.request, arktype(privacySchema))
	if (!form.valid) return formError(form)

	await setPlacePrivacy(id, form.data.privateServer)
	return message(form, "Privacy settings updated successfully!")
}
actions.avatar = async e => {
	const id = await getData(e)
	const form = await superValidate(e.request, arktype(avatarSchema))
	if (!form.valid) return formError(form)

	// players get the rig when they join (game/join/aya), so a running server
	// can keep going
	await db.update(Record("place", id)).merge({ rigType: form.data.rigType })
	return message(form, "Avatar settings updated successfully!")
}
actions.privatelink = async e => {
	const id = await getData(e)

	await db.query(privateTicketQuery, { place: Record("place", id) })
	return message(
		await superValidate(e.request, arktype(privatelinkSchema)),
		"Regenerated!"
	)
}
actions.data = async e => {
	const id = await getData(e)
	const formData = await e.request.formData()
	const form = await superValidate(formData, arktype(dataSchema))
	if (!form.valid) return formError(form)

	const { file } = form.data
	form.data.file = undefined as unknown as File
	if (file.size > maxPlaceFileSize)
		return formError(
			form,
			["file"],
			["File must be less than 100MB in size"]
		)

	await writePlaceFile(id, file)
	return message(form, "Place data updated successfully!")
}

// --- Store: game passes, developer products and badges ---

const maxPrice = 1_000_000

async function storeForm(e: RequestEvent, needsPrice: { min: number } | null) {
	const id = await getData(e)
	const data = await e.request.formData()
	const name = filter(String(data.get("name") ?? "").trim())
	const description = filter(String(data.get("description") ?? "").trim())
	const price = Number(data.get("price") ?? 0)
	const icon = data.get("icon")

	if (name.length < 3 || name.length > 50)
		return { id, error: fail(400, { store: "Name must be 3 to 50 characters" }) }
	if (description.length > 1000)
		return { id, error: fail(400, { store: "Description must be at most 1000 characters" }) }
	if (needsPrice && !(Number.isInteger(price) && price >= needsPrice.min && price <= maxPrice))
		return { id, error: fail(400, { store: `Price must be a whole number from ${needsPrice.min} to ${maxPrice}` }) }
	if (icon instanceof File && icon.size > 1e6)
		return { id, error: fail(400, { store: "Icon must be less than 1MB in size" }) }

	return {
		id,
		item: {
			name,
			description,
			price: needsPrice ? price : 0,
			icon: icon instanceof File && icon.size > 0 ? icon : undefined,
		},
	}
}

actions.createpass = async e => {
	const { id, error: err, item } = await storeForm(e, { min: 0 })
	if (err || !item) return err
	const { user } = await authorise(e.locals)
	try {
		await createStoreItem(id, user.id, GAME_PASS, item)
	} catch {
		return fail(400, { store: "Icon must be a valid image" })
	}
	return { store: `Game pass "${item.name}" created` }
}

actions.createbadge = async e => {
	const { id, error: err, item } = await storeForm(e, null)
	if (err || !item) return err
	const { user } = await authorise(e.locals)
	try {
		await createStoreItem(id, user.id, BADGE, item)
	} catch {
		return fail(400, { store: "Icon must be a valid image" })
	}
	return { store: `Badge "${item.name}" created` }
}

actions.createproduct = async e => {
	const { id, error: err, item } = await storeForm(e, { min: 1 })
	if (err || !item) return err
	await createDevProduct(id, { name: item.name, description: item.description, price: item.price })
	return { store: `Developer product "${item.name}" created` }
}

// price change and on sale / enabled toggle for one item
actions.updateitem = async e => {
	const id = await getData(e)
	const data = await e.request.formData()
	const kind = data.get("kind") === "devProduct" ? "devProduct" : "asset"
	const itemId = Number(data.get("item"))
	if (!Number.isSafeInteger(itemId)) return fail(400, { store: "Invalid item" })

	const changes: { price?: number; forSale?: boolean } = {}
	if (data.has("forSale")) changes.forSale = data.get("forSale") === "true"
	if (data.has("price")) {
		const price = Number(data.get("price"))
		const min = kind === "devProduct" ? 1 : 0
		if (!(Number.isInteger(price) && price >= min && price <= maxPrice))
			return fail(400, { store: `Price must be a whole number from ${min} to ${maxPrice}` })
		changes.price = price
	}
	await updateStoreItem(id, kind, itemId, changes)
	return { store: "Saved" }
}
