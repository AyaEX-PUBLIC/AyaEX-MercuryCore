import { error, redirect } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { parse } from "$lib/markdown"
import { db } from "$lib/server/surreal"
import { couldMatch, encode } from "$lib/urlName"
import postQuery from "./post.surql"

type Post = {
	id: string
	title: string
	body: string
	excerpt: string
	cover: boolean
	created: Date
	published?: Date
	updated: Date
	author: BasicUser
}

type More = {
	id: string
	title: string
	excerpt: string
	cover: boolean
	published: Date
}

export async function load({ locals, params }) {
	const { user } = await authorise(locals)

	const [post, more] = await db.query<[Post | null, More[]]>(postQuery, {
		id: params.id,
	})
	if (!post) error(404, "Not Found")

	// drafts and posts waiting for their date are for administrators to preview
	const live = !!post.published && post.published.getTime() <= Date.now()
	if (!live && user.permissionLevel < 5) error(404, "Not Found")

	if (!couldMatch(post.title, params.slug))
		redirect(301, `/news/${post.id}/${encode(post.title)}`)

	const { body, ...rest } = post
	return {
		post: { ...rest, blocks: parse(body) },
		more,
		live,
		canEdit: user.permissionLevel >= 5,
	}
}
