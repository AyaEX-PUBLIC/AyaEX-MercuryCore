// Contains various api methods that cannot be accessed in a page context,
// usually because they are requested from a component.

import { error, redirect } from "@sveltejs/kit"
import { authorise, cookieName, invalidateSession } from "$lib/server/auth"

// Only the form actions below are meant to be used
export function load() {
	error(404, "Not found")
}

export const actions: import("./$types").Actions = {}
actions.logout = async ({ cookies, locals }) => {
	const { session } = await authorise(locals)

	await invalidateSession(session)
	cookies.delete(cookieName, { path: "/" })

	redirect(302, "/login")
}
actions.statusping = () => {
	// does nothing
	// hooks.server.ts will update the user's status when pinged
}
