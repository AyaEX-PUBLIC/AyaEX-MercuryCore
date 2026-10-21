import { error, redirect } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { db } from "$lib/server/surreal"
import { encode } from "$lib/urlName"

// /news/<id> alone goes to the post's own address, which has its title in it
export async function load({ locals, params }) {
	await authorise(locals)
	const [post] = await db.query<({ title: string } | null)[]>(
		`SELECT title FROM ONLY type::record("news", $id)`,
		{ id: params.id }
	)
	if (!post) error(404, "Not Found")
	redirect(301, `/news/${params.id}/${encode(post.title)}`)
}
