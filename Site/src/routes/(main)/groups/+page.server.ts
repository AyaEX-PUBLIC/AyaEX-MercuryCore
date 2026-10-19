import { authorise } from "$lib/server/auth"
import exclude from "$lib/server/exclude"
import pageQuery from "$lib/server/pageQuery"
import { db } from "$lib/server/surreal"
import groupsQuery from "./groups.surql"

export type Group = {
	id: string
	name: string
	memberCount: number
}

export async function load({ locals, url }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	await authorise(locals)
	exclude("Groups")
	const { page, checkPages } = pageQuery(url)

	const [groups, pages] = await db.query<[Group[], number]>(groupsQuery, {
		page,
	})
	checkPages(pages)

	return { groups, pages }
}
