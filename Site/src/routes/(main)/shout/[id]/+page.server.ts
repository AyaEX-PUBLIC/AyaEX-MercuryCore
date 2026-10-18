import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { getShout } from "$lib/server/shoutbox"
import { staffLevel } from "$lib/shoutbox/permissions"

// One shoutbox message, linked from abuse reports. Moderators also see deleted
// messages and earlier versions of edited ones.
export async function load({ locals, params }) {
	const { user } = await authorise(locals)
	const found = await getShout(params.id, user)
	const staff = user.permissionLevel >= staffLevel
	if (!found || (found.deleted && !staff)) error(404, "Message not found")

	return {
		shout: found.shout,
		channel: { id: found.channel.id, name: found.channel.name },
		moderation: staff
			? {
					deleted: found.deleted,
					deletedBy: found.deletedBy,
					history: found.history,
				}
			: null,
	}
}
