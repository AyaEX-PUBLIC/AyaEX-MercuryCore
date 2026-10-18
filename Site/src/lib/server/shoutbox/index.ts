// The shoutbox: chat channels on the home page. Channels are managed by
// administrators (routes/(main)/admin/shoutbox), and each has the lowest
// permission levels that can read and post in it. Messages are checked and
// cleaned here, whichever route they come from, and changes go out live
// through ./live.ts.

import { error } from "@sveltejs/kit"
import { db, Record } from "$lib/server/surreal"
import { editWindow } from "$lib/shoutbox/limits"
import {
	canModerate,
	canRead,
	canWrite,
	staffLevel,
} from "$lib/shoutbox/permissions"
import type { Channel, Shout } from "$lib/shoutbox/types"
import channelsQuery from "./channels.surql"
import clean from "./clean"
import editQuery from "./edit.surql"
import { publish } from "./live"
import messagesQuery from "./messages.surql"
import sendQuery from "./send.surql"
import shoutQuery from "./shout.surql"

const maxEdits = 10
export const pageSize = 50

/** Channel and message ids, as given by the database */
export const channelId = /^[A-Za-z0-9]{1,40}$/
export const shoutId = /^[0-9A-Z]{26}$/

type Row<T> = Omit<T, "created" | "edited" | "last"> & {
	created: Date
	edited?: Date | null
	last?: Date | null
}

const toShout = (row: Row<Shout>): Shout => ({
	id: row.id,
	channel: row.channel,
	author: row.author,
	body: row.body,
	created: row.created.getTime(),
	edited: row.edited?.getTime() || null,
})

let channels: Channel[] = []
let loaded: Promise<void> | null = null

type ChannelRow = Omit<Channel, "last" | "lastBy"> & {
	position: number
	latest?: { created: Date; by: string }
}

async function loadChannels() {
	const [rows] = await db.query<ChannelRow[][]>(channelsQuery)
	channels = rows.map(({ position, latest, ...c }) => ({
		...c,
		last: latest?.created.getTime() || null,
		lastBy: latest?.by || null,
	}))
}

/** All channels, in order. Cached until an administrator changes them. */
export async function getChannels() {
	loaded ||= loadChannels().catch(e => {
		loaded = null
		throw e
	})
	await loaded
	return channels
}

/** The cached channel list, for live updates that can't wait for the database */
export const cachedChannel = (id: string) => channels.find(c => c.id === id)

/** Reloads the channels after an administrator changes them, and tells clients */
export async function channelsChanged() {
	loaded = loadChannels()
	await loaded
	publish({ type: "channels" })
}

export async function readableChannels(level: number) {
	return (await getChannels()).filter(c => canRead(c, level))
}

/** A channel the user can read, or a 404 as if it didn't exist */
async function readable(id: string, user: User) {
	const channel = channelId.test(id)
		? (await getChannels()).find(c => c.id === id)
		: undefined
	if (!channel || !canRead(channel, user.permissionLevel))
		error(404, "Channel not found")
	return channel
}

export async function messages(channel: string, user: User, before?: number) {
	const c = await readable(channel, user)
	const [rows] = await db.query<Row<Shout>[][]>(messagesQuery, {
		channel: Record("shoutChannel", c.id),
		before: before ? new Date(before) : null,
		limit: pageSize,
	})
	return rows.map(toShout).reverse()
}

type FullShout = Row<Shout> & {
	authorId: string
	deleted: boolean
	deletedBy: string | null
	history: string[]
}

/** One message, including deleted ones, if the user can see its channel */
export async function getShout(id: string, user: User) {
	if (!shoutId.test(id)) return
	const [, shout] = await db.query<FullShout[]>(
		`LET $shout = type::record("shout", $id); ${shoutQuery}`,
		{ id }
	)
	if (!shout) return
	const channel = (await getChannels()).find(c => c.id === shout.channel)
	if (!channel || !canRead(channel, user.permissionLevel)) return
	return {
		shout: toShout(shout),
		channel,
		authorId: shout.authorId,
		deleted: shout.deleted,
		deletedBy: shout.deletedBy,
		history: shout.history,
	}
}

// Rate limits, kept in memory like lib/server/ratelimit.ts: a burst of 5
// messages (or edits), then one every 2 seconds. Repeating your last message
// in a channel and posting during its slow mode are refused too.
const buckets = new Map<string, { tokens: number; at: number }>()
// by user and channel
const lastSent = new Map<string, { body: string; at: number }>()

function limit(key: string, burst: number, refill: number, message: string) {
	const now = Date.now()
	if (buckets.size > 10e3)
		for (const [k, b] of buckets) if (now - b.at > 60e3) buckets.delete(k)
	if (lastSent.size > 10e3)
		for (const [k, l] of lastSent)
			if (now - l.at > 3600e3) lastSent.delete(k)

	const bucket = buckets.get(key) || { tokens: burst, at: now }
	bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.at) / refill)
	bucket.at = now
	buckets.set(key, bucket)
	if (bucket.tokens < 1) error(429, message)
	bucket.tokens--
}

const spend = (user: string) =>
	limit(`send:${user}`, 5, 2e3, "You're sending messages too fast")

/** Loading older messages: a burst of 20 pages, then two a second */
export const historyLimit = (user: string) =>
	limit(`history:${user}`, 20, 500, "Too many requests")

async function checkModeration(user: User) {
	// the hooks already send moderated users to /moderation; this is a backup
	const [moderated] = await db.query<boolean[]>(
		"!!SELECT 1 FROM moderation WHERE out = $user AND active",
		{ user: Record("user", user.id) }
	)
	if (moderated) error(403, "You can't post while your account is moderated")
}

function cleaned(input: string) {
	const result = clean(input)
	if ("error" in result) error(400, result.error)
	return result.text
}

export async function send(channel: string, input: string, user: User) {
	const c = await readable(channel, user)
	if (!canWrite(c, user.permissionLevel))
		error(403, "You can't post in this channel")
	const body = cleaned(input)

	const now = Date.now()
	const key = `${user.id}:${c.id}`
	const last = lastSent.get(key)
	if (last) {
		if (last.body === body && now - last.at < 30e3)
			error(429, "You just sent that")
		const wait = c.slowmode * 1e3 - (now - last.at)
		if (wait > 0 && user.permissionLevel < staffLevel)
			error(429, `Slow mode is on: wait ${Math.ceil(wait / 1e3)}s`)
	}
	spend(user.id)
	await checkModeration(user)

	const [, row] = await db.query<Row<Shout>[]>(sendQuery, {
		user: Record("user", user.id),
		body,
		channel: Record("shoutChannel", c.id),
	})
	lastSent.set(key, { body, at: now })

	const shout = toShout(row)
	c.last = shout.created
	c.lastBy = user.username
	publish({ type: "new", channel: c.id, shout })
	return shout
}

export async function edit(id: string, input: string, user: User) {
	const found = await getShout(id, user)
	if (!found || found.deleted) error(404, "Message not found")
	if (found.authorId !== user.id)
		error(403, "You can only edit your own messages")
	if (!canWrite(found.channel, user.permissionLevel))
		error(403, "You can't post in this channel")
	if (Date.now() - found.shout.created > editWindow)
		error(403, "This message is too old to edit")
	if (found.history.length >= maxEdits)
		error(403, "This message can't be edited again")

	const body = cleaned(input)
	if (body === found.shout.body) return found.shout
	spend(user.id)
	await checkModeration(user)

	const [, row] = await db.query<Row<Shout>[]>(editQuery, {
		shout: Record("shout", id),
		body,
	})
	const edited = toShout(row)
	publish({ type: "edit", channel: edited.channel, shout: edited })
	return edited
}

export async function remove(id: string, user: User) {
	const found = await getShout(id, user)
	if (!found || found.deleted) error(404, "Message not found")
	const { shout, channel } = found
	const own = found.authorId === user.id
	if (!own && !canModerate(shout.author.level, user.permissionLevel))
		error(403, "You can't delete this message")
	if (own) spend(user.id)

	await db.query(
		`UPDATE $shout SET deleted = true, deletedBy = $user;
		IF $log {
			fn::auditLog("Moderation", $log, $user);
		};`,
		{
			shout: Record("shout", id),
			user: Record("user", user.id),
			log: own
				? null
				: `Delete shoutbox message ${id} by ${shout.author.username} in #${channel.name}: "${shout.body.slice(0, 200)}"`,
		}
	)
	publish({ type: "delete", channel: channel.id, id })
}
