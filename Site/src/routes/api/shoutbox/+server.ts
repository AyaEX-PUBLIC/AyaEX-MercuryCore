// The shoutbox channels the user can read, and the live cursor to stream from,
// for clients that reload after the channels change or their stream resets

import { error, json } from "@sveltejs/kit"
import { readableChannels } from "$lib/server/shoutbox"
import { cursor } from "$lib/server/shoutbox/live"

export async function GET({ locals }) {
	const { user } = locals
	if (!user) error(401, "You must be logged in")

	return json(
		{
			cursor: cursor(),
			channels: await readableChannels(user.permissionLevel),
		},
		{ headers: { "Cache-Control": "no-store" } }
	)
}
