// Sending, editing and deleting shoutbox messages. lib/server/shoutbox checks
// permissions, limits and content, and sends the change to everyone live.

import { type } from "arktype"
import { command, getRequestEvent } from "$app/server"
import { authorise } from "$lib/server/auth"
import { edit, remove, send } from "$lib/server/shoutbox"

const body = "string <= 4000" // cleaned and checked properly afterwards
const id = "string <= 40"

const currentUser = async () => (await authorise(getRequestEvent().locals)).user

export const sendShout = command(
	type({ channel: id, body }),
	async ({ channel, body }) => send(channel, body, await currentUser())
)

export const editShout = command(type({ id, body }), async ({ id, body }) =>
	edit(id, body, await currentUser())
)

export const deleteShout = command(type({ id }), async ({ id }) =>
	remove(id, await currentUser())
)
