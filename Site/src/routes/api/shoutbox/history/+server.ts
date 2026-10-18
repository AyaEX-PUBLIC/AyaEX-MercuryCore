// A page of shoutbox messages in a channel, oldest first, sent before a time
// (milliseconds) if one is given

import { error, json } from "@sveltejs/kit"
import { historyLimit, messages } from "$lib/server/shoutbox"

export async function GET({ locals, url }) {
	const { user } = locals
	if (!user) error(401, "You must be logged in")
	historyLimit(user.id)

	const channel = url.searchParams.get("channel") || ""
	const before = Number(url.searchParams.get("before")) || undefined

	return json(await messages(channel, user, before), {
		headers: { "Cache-Control": "no-store" },
	})
}
