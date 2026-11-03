import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"
import { db, Record } from "$lib/server/surreal"
import getNotifications from "../../notifications"
import readQuery from "./read.surql"
import readAllQuery from "./readAll.surql"

const pageSize = 30

export async function load({ locals, url }) {
	const { user } = await authorise(locals)
	const { page, checkPages } = pageQuery(url)

	// a page of them as they were, so the unread ones still stand out, and
	// only then mark them all as read
	const { notifications, count } = await getNotifications(user, {
		size: pageSize,
		page,
	})
	const pages = Math.max(1, Math.ceil(count / pageSize))
	checkPages(pages)

	await db.query(readAllQuery, {
		user: Record("user", user.id),
	})

	return { notifications, count, pages }
}

export const actions: import("./$types").Actions = {}
actions.default = async ({ locals, url }) => {
	const { user } = await authorise(locals)
	const id = url.searchParams.get("s")
	if (!id) error(400)

	try {
		await db.query(readQuery, {
			notification: Record("notification", id),
			user: Record("user", user.id),
		})
	} catch {
		error(400)
	}
}
