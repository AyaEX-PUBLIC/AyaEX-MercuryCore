import { redirect } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"

// Accounts without a recovery phrase are sent here by the hooks, and can't
// do anything else until they've made one (through /api/auth)
export async function load({ locals }) {
	const { user } = await authorise(locals)
	if (user.hasPhrase) redirect(302, "/home")
	return { username: user.username }
}
