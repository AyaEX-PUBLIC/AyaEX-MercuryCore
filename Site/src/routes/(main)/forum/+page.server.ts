import { authorise } from "$lib/server/auth"
import exclude from "$lib/server/exclude"
import { db } from "$lib/server/surreal"
import forumQuery from "./forum.surql"

export type PreviewPost = {
	id: string
	author: BasicUser
	created: Date
	currentContent: string
}

type Category = {
	description: string
	latestPost: PreviewPost
	name: string
	postCount: number
}

export async function load({ locals }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	await authorise(locals)
	exclude("Forum")
	const [categories] = await db.query<Category[][]>(forumQuery)
	return { categories }
}
