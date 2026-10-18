import { fail } from "@sveltejs/kit"
import { type } from "arktype"
import { authorise } from "$lib/server/auth"
import { channelsChanged, channelId } from "$lib/server/shoutbox"
import { db, Record } from "$lib/server/surreal"
import channelsQuery from "./channels.surql"

// Shoutbox channels: only administrators can manage them

type Channel = {
	id: string
	name: string
	description: string
	position: number
	readLevel: number
	writeLevel: number
	slowmode: number
	messages: number
}

const level = type("1 <= number.integer <= 5")
const schema = type({
	name: type(/^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/).configure({
		problem:
			"must be 1-24 lowercase letters, numbers or dashes (not at the start or end)",
	}),
	description: "string <= 120",
	position: "0 <= number.integer <= 999",
	readLevel: level,
	writeLevel: level,
	slowmode: "0 <= number.integer <= 3600",
})

export async function load({ locals }) {
	await authorise(locals, 5)
	const [channels] = await db.query<Channel[][]>(channelsQuery)
	return { channels }
}

async function parse(request: Request) {
	const data = await request.formData()
	const field = (name: string) => data.get(name)?.toString().trim() || ""
	const result = schema({
		name: field("name").toLowerCase(),
		// one line of plain text
		description: field("description")
			.replace(/[\p{Cc}\p{Cf}\p{Co}]/gu, "")
			.replace(/\s+/g, " "),
		position: Number(field("position")),
		readLevel: Number(field("readLevel")),
		writeLevel: Number(field("writeLevel")),
		slowmode: Number(field("slowmode")),
	})
	if (result instanceof type.errors) return { error: result.summary }
	// posting needs reading too
	result.writeLevel = Math.max(result.readLevel, result.writeLevel)
	return { channel: result }
}

async function nameTaken(name: string, except = "") {
	const [taken] = await db.query<boolean[]>(
		"!!SELECT 1 FROM shoutChannel WHERE !deleted AND name = $name AND id != $except",
		{ name, except: Record("shoutChannel", except || "none") }
	)
	return taken
}

const log = (user: User, note: string) =>
	db.run("fn::auditLog", ["Administration", note, Record("user", user.id)])

export const actions: import("./$types").Actions = {}
actions.create = async ({ locals, request }) => {
	const { user } = await authorise(locals, 5)
	const { channel, error } = await parse(request)
	if (!channel) return fail(400, { msg: error })
	if (await nameTaken(channel.name))
		return fail(400, { msg: `There's already a #${channel.name} channel` })

	await db.query("CREATE shoutChannel CONTENT $channel", { channel })
	await log(user, `Create shoutbox channel #${channel.name}`)
	await channelsChanged()
	return { msg: `Created #${channel.name}` }
}
actions.update = async ({ locals, request, url }) => {
	const { user } = await authorise(locals, 5)
	const id = url.searchParams.get("id") || ""
	if (!channelId.test(id)) return fail(400, { msg: "Invalid channel" })
	const { channel, error } = await parse(request)
	if (!channel) return fail(400, { msg: error, id })
	if (await nameTaken(channel.name, id))
		return fail(400, {
			msg: `There's already a #${channel.name} channel`,
			id,
		})

	const [updated] = await db.query<unknown[]>(
		"UPDATE $id MERGE $channel WHERE !deleted",
		{ id: Record("shoutChannel", id), channel }
	)
	if (!updated?.length) return fail(404, { msg: "Channel not found", id })
	await log(
		user,
		`Update shoutbox channel #${channel.name}: read ${channel.readLevel}, write ${channel.writeLevel}, slow mode ${channel.slowmode}s`
	)
	await channelsChanged()
	return { msg: `Saved #${channel.name}`, id }
}
actions.delete = async ({ locals, url }) => {
	const { user } = await authorise(locals, 5)
	const id = url.searchParams.get("id") || ""
	if (!channelId.test(id)) return fail(400, { msg: "Invalid channel" })

	// messages are kept, so moderators can still look at them
	const [deleted] = await db.query<{ name: string }[][]>(
		"UPDATE $id SET deleted = true WHERE !deleted RETURN name",
		{ id: Record("shoutChannel", id) }
	)
	if (!deleted?.length) return fail(404, { msg: "Channel not found" })
	await log(user, `Delete shoutbox channel #${deleted[0].name}`)
	await channelsChanged()
	return { msg: `Deleted #${deleted[0].name}` }
}
