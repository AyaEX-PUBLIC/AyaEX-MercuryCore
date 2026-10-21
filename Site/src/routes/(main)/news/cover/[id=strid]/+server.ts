import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { db } from "$lib/server/surreal"

// A post's cover image, made when the post was saved (Admin > News)
export async function GET({ locals, params }) {
	const { user } = await authorise(locals)

	const [post] = await db.query<
		({ cover: boolean; published?: Date } | null)[]
	>(`SELECT cover, published FROM ONLY type::record("news", $id)`, {
		id: params.id,
	})
	if (!post?.cover) error(404, "Not Found")

	const live = !!post.published && post.published.getTime() <= Date.now()
	if (!live && user.permissionLevel < 5) error(404, "Not Found")

	const file = Bun.file(`../data/news/${params.id}.avif`)
	if (!(await file.exists())) error(404, "Not Found")

	return new Response(file, {
		headers: { "Content-Type": "image/avif", "Cache-Control": "no-cache" },
	})
}
