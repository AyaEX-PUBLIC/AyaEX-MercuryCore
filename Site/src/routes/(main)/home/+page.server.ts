import { authorise } from "$lib/server/auth"
import { messages, pageSize, readableChannels } from "$lib/server/shoutbox"
import { cursor } from "$lib/server/shoutbox/live"
import { db, Record } from "$lib/server/surreal"
import homeQuery from "./home.surql"

type Place = {
	id: number
	name: string
	playerCount: number
	serverPing: number
	likeCount: number
	dislikeCount: number
}

// lazy eval 💞
const greets: readonly ((u: string) => string)[] = Object.freeze([
	u => `Hi, ${u}!`,
	u => `Hello, ${u}!`,
])

export async function load({ locals, url }) {
	const { user } = await authorise(locals)
	// (main)/+layout.server.ts will handle most redirects for logged-out users, but sometimes errors for this page.

	// taken before loading messages, so the live stream can't miss any sent meanwhile
	const live = cursor()
	const channels = await readableChannels(user.permissionLevel)
	const wanted = url.searchParams.get("channel")
	const channel = channels.find(c => c.id === wanted) || channels[0]

	const [[places, friends], shouts] = await Promise.all([
		db.query<[Place[], BasicUser[]]>(homeQuery, {
			user: Record("user", user.id),
		}),
		channel ? messages(channel.id, user) : [],
	])

	return {
		greet: greets[Math.floor(Math.random() * greets.length)](user.username),
		places,
		friends,
		shoutbox: {
			channels,
			channel: channel?.id || "",
			messages: shouts,
			cursor: live,
			pageSize,
		},
	}
}
