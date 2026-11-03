import fs from "node:fs"
import { error, fail, redirect } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import config from "$lib/server/config"
import like from "$lib/server/like"
import formData from "$lib/server/formData"
import {
	closeGameserver,
	gameserverActive,
	startGameserver,
} from "$lib/server/orbiter"
import ratelimit from "$lib/server/ratelimit"
import { BADGE, buyGamePass, GAME_PASS, placeItems, storeItem } from "$lib/server/store"
import { db, findWhere, Record } from "$lib/server/surreal"
import { couldMatch, encode } from "$lib/urlName"
import closedQuery from "./closed.surql"
import findPlaceQuery from "./findPlace.surql"
import invalidatePlayingQuery from "./invalidatePlaying.surql"
import placeQuery from "./place.surql"

type FoundPlace = {
	ownerUsername: string
	privateServer: boolean
	privateTicket: string
	clientVersion: number
}

interface Place extends FoundPlace {
	created: string
	description: string
	dislikeCount: number
	dislikes: boolean
	id: number
	likeCount: number
	likes: boolean
	maxPlayers: number
	name: string
	clientVersion: number
	ownerUser: BasicUser
	players: {
		status: "Playing"
		username: string
	}[]
	serverPing: number
	updated: Date
}

const thumbnails = config.Images.DefaultPlaceThumbnails

export async function load({ locals, params, url }) {
	const { user } = await authorise(locals)
	const privateTicket = url.searchParams.get("privateServer")
	const id = +params.id
	const [[place]] = await db.query<Place[][]>(placeQuery, {
		user: Record("user", user.id),
		place: Record("place", id),
	})
	if (!place) error(404, "Place not found")

	const isOwner = user.username === place.ownerUser.username
	if (
		!isOwner &&
		place.privateServer &&
		privateTicket !== place.privateTicket
	)
		error(404, "Place not found")

	// the private link is the owner's to share: others only get back the one
	// they came with, and nobody gets it while the place is public
	if (!isOwner) place.privateTicket = place.privateServer ? privateTicket || "" : ""

	// ahh, reminds me of early Mercury 2
	const slug = encode(place.name)
	if (!couldMatch(place.name, params.name))
		redirect(302, `/place/${id}/${slug}`)

	// don't check gameserver status here or your mercury will slow to a crawl

	const [gamePasses, badges] = await Promise.all([
		placeItems(id, GAME_PASS, user.id),
		placeItems(id, BADGE, user.id),
	])

	return {
		// passes on sale (or already owned) and enabled badges
		gamePasses: gamePasses.filter(p => p.forSale || p.owned),
		badges: badges.filter(b => b.forSale),
		scheme: config.LauncherURI,
		webPlayerURL: config.WebPlayerURL,
		clientVersion: place.clientVersion,
		orbiterURL: config.Orbiter.PublicURL,
		slug,
		place,
		thumbnails: [id % thumbnails.length],
	}
}

async function findPlace(request: Request, id: number, user: User) {
	const data = await formData(request)
	const privateTicket = data?.privateTicket

	const placeR = Record("place", id)
	const [[place]] = await db.query<FoundPlace[][]>(findPlaceQuery, {
		place: placeR,
	})

	if (
		!place ||
		(user.username !== place.ownerUsername &&
			place.privateServer &&
			privateTicket !== place.privateTicket)
	)
		error(404, "Place not found")

	return [place, placeR] as const
}

async function checkUser(locals: App.Locals) {
	const { user } = await authorise(locals)

	const foundModerated = await findWhere(
		"moderation",
		"out = $user AND active = true",
		{ user: Record("user", user.id) }
	)
	if (foundModerated) error(403, "You cannot currently play games")

	return user
}

export const actions: import("./$types").Actions = {}
actions.join = async ({ locals, params, request }) => {
	const user = await checkUser(locals)
	const [place, placeR] = await findPlace(request, +params.id, user)

	// Replace the user's game sessions with a valid one, remembering the private
	// link findPlace accepted (see game/join/aya/latestPlaying.surql)
	const [, , [ticket]] = await db.query<string[][]>(invalidatePlayingQuery, {
		user: Record("user", user.id),
		place: placeR,
		privateTicket: place.privateServer ? place.privateTicket : undefined,
	})

	return { ticket }
}

actions.start = async ({ fetch: f, locals, params, request }) => {
	const user = await checkUser(locals)

	const id = +params.id
	const [_place, _placeR] = await findPlace(request, id, user)

	// a Play while the place's server is starting or running starts nothing
	// (the Orbiter ignores it), so it doesn't count towards the limit
	if (await gameserverActive(f, id)) return

	// per user, not per place: one account mustn't start a server for every place
	const limit = ratelimit(null, "serverstart", user.id, 20)
	if (limit) return limit

	// check for existence of a place file
	const placeFile = `../data/places/${id}`
	if (!fs.existsSync(placeFile)) error(404, "Place file not found")

	const res = await startGameserver(f, id, _place.clientVersion)
	if (res.ok) return

	console.error("Failed to start dedicated gameserver for id", id, res.msg)
	error(500, "Failed to start dedicated server")
}

actions.close = async ({ fetch: f, locals, params, request }) => {
	const { user } = await authorise(locals)
	const id = +params.id

	const [place] = await findPlace(request, id, user)

	if (user.username !== place.ownerUsername && user.permissionLevel < 4)
		error(403, "You do not have permission to close this server.")

	const res = await closeGameserver(f, id)
	if (res.ok) {
		await db.query(closedQuery, { place: Record("place", id) })
		return { closed: true }
	}

	console.error("Failed to close dedicated gameserver for id", id, res.msg)
	error(500, "Failed to close dedicated server")
}

const likeActions = Object.freeze([
	"like",
	"unlike",
	"dislike",
	"undislike",
] as const)
type LikeAction = (typeof likeActions)[number]

actions.like = async ({ locals, params, request }) => {
	const { user } = await authorise(locals)
	const data = await formData(request)
	const action = data.action as LikeAction
	if (!likeActions.includes(action)) error(400, "Invalid action")

	const id = +params.id
	const [[place]] = await db.query<FoundPlace[][]>(findPlaceQuery, {
		place: Record("place", id),
	})
	if (
		!place ||
		(user.username !== place.ownerUsername &&
			place.privateServer &&
			data.privateTicket !== place.privateTicket)
	)
		error(404, "Place not found")

	await like(Record("user", user.id), Record("place", id), action)
}

// buy a game pass from the place page (same rules as buying it in game)
actions.buypass = async ({ fetch: f, locals, params, request }) => {
	const user = await checkUser(locals)
	const data = await formData(request)
	const id = +params.id
	const passId = Number(data.pass)
	const expectedPrice = Number(data.price)

	const [[place]] = await db.query<FoundPlace[][]>(findPlaceQuery, {
		place: Record("place", id),
	})
	if (
		!place ||
		(user.username !== place.ownerUsername &&
			place.privateServer &&
			data.privateTicket !== place.privateTicket)
	)
		error(404, "Place not found")

	const pass = Number.isSafeInteger(passId) ? await storeItem(passId, GAME_PASS) : undefined
	if (!pass || pass.place !== id) error(404, "Game pass not found")

	const result = await buyGamePass(
		f,
		user.id,
		passId,
		Number.isSafeInteger(expectedPrice) ? expectedPrice : undefined
	)
	if (!result.success && result.status !== "AlreadyOwned")
		return fail(400, { pass: passId, status: result.status })
	return { pass: passId, status: result.status }
}
