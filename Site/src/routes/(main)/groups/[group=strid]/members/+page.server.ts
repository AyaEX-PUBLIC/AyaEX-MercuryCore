// The members page for a group.

import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import exclude from "$lib/server/exclude"
import pageQuery from "$lib/server/pageQuery"
import { db, Record } from "$lib/server/surreal"
import membersQuery from "./members.surql"

type Group = {
	memberCount: number
	name: string
}

// members on a page: fills rows of 2 and of 3
const pageSize = 60

export async function load({ locals, params, url }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	await authorise(locals)
	exclude("Groups")
	const { page, checkPages } = pageQuery(url)
	const [[group], members] = await db.query<[Group[], BasicUser[]]>(
		membersQuery,
		{ group: Record("group", params.group), page }
	)
	if (!group) error(404, "Not Found")

	const pages = Math.max(1, Math.ceil(group.memberCount / pageSize))
	checkPages(pages)

	return { ...group, members, pages }
}
