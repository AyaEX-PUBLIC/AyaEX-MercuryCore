// The members page for a group.

import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import exclude from "$lib/server/exclude"
import { db, Record } from "$lib/server/surreal"
import membersQuery from "./members.surql"

type Group = {
	memberCount: number
	members: BasicUser[]
	name: string
}

export async function load({ locals, params }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	await authorise(locals)
	exclude("Groups")
	const [[group]] = await db.query<Group[][]>(membersQuery, {
		group: Record("group", params.group),
	})
	if (!group) error(404, "Not Found")
	return group
}
