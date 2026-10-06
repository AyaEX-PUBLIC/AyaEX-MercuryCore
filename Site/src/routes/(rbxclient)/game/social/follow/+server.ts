import { error } from "@sveltejs/kit"
import { engineParams, json } from "$lib/server/engineParams"
import { userFromEngineId } from "$lib/server/engineUser"
import { follow } from "$lib/server/social"

// user/follow (player dropdown, from the browser Player with the session;
// see Caddyfile.aya): followedUserId is an engine user ID
export async function POST({ locals, request, url }) {
	if (!locals.user) error(401, "Unauthorized")
	const params = await engineParams(request, url)
	const other = await userFromEngineId(params.int("followedUserId") ?? 0)
	if (!other) return json({ success: false, message: "User not found" })
	if (other.id === locals.user.id) return json({ success: false, message: "You can't follow yourself" })
	await follow(locals.user, other)
	return json({ success: true })
}
