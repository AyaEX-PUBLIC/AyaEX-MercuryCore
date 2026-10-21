import fs from "node:fs/promises"
import { error, redirect } from "@sveltejs/kit"
import { type } from "arktype"
import sharp from "sharp"
import { excerpt } from "$lib/markdown"
import { idRegex } from "$lib/paramTests"
import { authorise } from "$lib/server/auth"
import formError from "$lib/server/formError"
import ratelimit from "$lib/server/ratelimit"
import { db, Record } from "$lib/server/surreal"
import { arktype, errMessage, superValidate } from "$lib/server/validate"
import type { RequestEvent } from "./$types.d"
import createQuery from "./create.surql"
import deleteQuery from "./delete.surql"
import postQuery from "./post.surql"
import postsQuery from "./posts.surql"
import setPublishedQuery from "./setPublished.surql"
import updateQuery from "./update.surql"

// News posts, written in Markdown (lib/markdown.ts); readers see them at /news

const schema = type({
	id: "(string | undefined)?",
	title: "string",
	body: "string",
	intent: "'publish' | 'draft'",
	publishAt: "(string | undefined)?",
	cover: "(File | undefined)?",
	removeCover: "(boolean | undefined)?",
})

type Post = {
	id: string
	title: string
	cover: boolean
	created: Date
	published?: Date
	updated: Date
	author: BasicUser
}

type Editing = Pick<Post, "id" | "title" | "cover" | "published"> & {
	body: string
}

const coverFile = (id: string) => `../data/news/${id}.avif`

export async function load({ locals, url }) {
	await authorise(locals, 5)

	const wanted = url.searchParams.get("edit")
	const [[posts], editing] = await Promise.all([
		db.query<[Post[]]>(postsQuery),
		wanted && idRegex.test(wanted)
			? db
					.query<[Editing | null]>(postQuery, { id: wanted })
					.then(([post]) => post)
			: null,
	])
	if (wanted && !editing) error(404, "No such post")

	return {
		posts,
		editing,
		form: await superValidate(
			editing
				? { id: editing.id, title: editing.title, body: editing.body }
				: undefined,
			arktype(schema)
		),
	}
}

async function getData({ locals, request }: RequestEvent) {
	const { user } = await authorise(locals, 5)
	const form = await superValidate(request, arktype(schema))
	return { user, form, error: !form.valid && formError(form) }
}

function postId(url: URL) {
	const id = url.searchParams.get("id")
	if (!id || !idRegex.test(id)) error(400, "Missing post")
	return id
}

async function titleOf(id: string) {
	const [post] = await db.query<({ title: string } | null)[]>(
		`SELECT title FROM ONLY type::record("news", $id)`,
		{ id }
	)
	if (!post) error(404, "No such post")
	return post.title
}

export const actions: import("./$types").Actions = {}
actions.save = async e => {
	const { user, form, error: invalid } = await getData(e)
	if (invalid) return invalid

	const { id, intent, publishAt, cover, removeCover } = form.data
	const title = form.data.title.trim().replace(/\s+/g, " ")
	const body = form.data.body.replace(/\r\n?/g, "\n").trim()
	// the cover is a file, which can't be sent back to the form
	form.data.cover = undefined

	if (title.length < 3 || title.length > 100)
		return formError(form, ["title"], ["Title must be 3 to 100 characters"])
	if (!body) return formError(form, ["body"], ["Write something first"])
	if (body.length > 20000)
		return formError(
			form,
			["body"],
			["Posts can be up to 20,000 characters"]
		)
	if (id && !idRegex.test(id)) return errMessage(form, "Invalid post")

	let existing: Editing | null = null
	if (id) {
		;[existing] = await db.query<[Editing | null]>(postQuery, { id })
		if (!existing) return errMessage(form, "That post no longer exists")
	}

	// the cover is converted first, so a file that isn't an image changes nothing
	let image: Buffer | undefined
	if (cover && cover.size > 0) {
		if (cover.size > 5e6)
			return formError(
				form,
				["cover"],
				["Cover must be less than 5MB in size"]
			)
		try {
			image = await sharp(await cover.arrayBuffer())
				.rotate()
				.resize(1280, 720, { fit: "cover" })
				.avif({ effort: 4 })
				.toBuffer()
		} catch {
			return formError(form, ["cover"], ["Cover must be a valid image"])
		}
	}

	// publishing keeps a post's date unless another is given; a date to come
	// schedules it
	let published: Date | null = null
	if (intent === "publish") {
		if (publishAt) {
			published = new Date(publishAt)
			if (Number.isNaN(published.getTime()))
				return formError(form, ["publishAt"], ["That isn't a date"])
		} else published = existing?.published ?? new Date()
	}

	const limit = ratelimit(form, "saveNews", user.id, 5)
	if (limit) return limit

	const hasCover = image
		? true
		: removeCover
			? false
			: (existing?.cover ?? false)
	const params = {
		user: Record("user", user.id),
		body,
		cover: hasCover,
		excerpt: excerpt(body),
		published,
		title,
	}

	let saved = id
	if (existing) {
		await db.query(updateQuery, {
			...params,
			id,
			note: `Edit news post "${title}"`,
		})
	} else {
		;[saved] = await db.query<[string, unknown]>(createQuery, {
			...params,
			note: `Create news post "${title}"${published ? "" : " (draft)"}`,
		})
	}

	if (image) {
		await fs.mkdir("../data/news", { recursive: true })
		await Bun.write(coverFile(saved as string), image)
	} else if (!hasCover)
		await fs.rm(coverFile(saved as string), { force: true })

	redirect(303, `/admin/news?tab=All+posts&saved=${intent}`)
}
actions.publish = async ({ locals, url }) => {
	const { user } = await authorise(locals, 5)
	const id = postId(url)
	const title = await titleOf(id)
	await db.query(setPublishedQuery, {
		id,
		user: Record("user", user.id),
		published: new Date(),
		note: `Publish news post "${title}"`,
	})
}
actions.unpublish = async ({ locals, url }) => {
	const { user } = await authorise(locals, 5)
	const id = postId(url)
	const title = await titleOf(id)
	await db.query(setPublishedQuery, {
		id,
		user: Record("user", user.id),
		published: null,
		note: `Unpublish news post "${title}"`,
	})
}
actions.delete = async ({ locals, url }) => {
	const { user } = await authorise(locals, 5)
	const id = postId(url)
	const title = await titleOf(id)
	await db.query(deleteQuery, {
		id,
		user: Record("user", user.id),
		note: `Delete news post "${title}"`,
	})
	await fs.rm(coverFile(id), { force: true })
}
