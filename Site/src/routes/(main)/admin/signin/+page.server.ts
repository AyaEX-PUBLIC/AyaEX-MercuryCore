import { fail } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { endPasswordSignIn, migrationStatus } from "$lib/server/phrase"
import { Record } from "$lib/server/surreal"

// The move from passwords to recovery phrases (lib/server/phrase.ts)
export async function load({ locals }) {
	await authorise(locals, 5)
	return { status: await migrationStatus() }
}

export const actions: import("./$types").Actions = {}
actions.end = async ({ locals, request }) => {
	const { user } = await authorise(locals, 5)
	if ((await request.formData()).get("confirm") !== "yes")
		return fail(400, { error: "Tick the box to confirm" })
	return { deleted: await endPasswordSignIn(Record("user", user.id)) }
}
