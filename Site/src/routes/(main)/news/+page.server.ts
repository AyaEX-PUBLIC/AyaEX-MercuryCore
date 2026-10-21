import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"
import { db } from "$lib/server/surreal"
import newsQuery from "./news.surql"

type Post = {
	id: string
	title: string
	excerpt: string
	cover: boolean
	published: Date
	updated: Date
	author: BasicUser
}

// the first page opens with the lead story and a full grid of three rows
// beside it; later pages are a full grid
const firstPage = 10
const laterPages = 9

/** "Wednesday, October 21st, 2026" */
function dateline(d: Date) {
	const day = d.getDate()
	const ordinal =
		day % 10 === 1 && day !== 11
			? "st"
			: day % 10 === 2 && day !== 12
				? "nd"
				: day % 10 === 3 && day !== 13
					? "rd"
					: "th"
	const weekday = d.toLocaleDateString("en-US", { weekday: "long" })
	const month = d.toLocaleDateString("en-US", { month: "long" })
	return `${weekday}, ${month} ${day}${ordinal}, ${d.getFullYear()}`
}

export async function load({ locals, url }) {
	await authorise(locals)

	const { page, checkPages } = pageQuery(url)
	const [posts, total] = await db.query<[Post[], number]>(newsQuery, {
		limit: page === 1 ? firstPage : laterPages,
		start: page === 1 ? 0 : firstPage + (page - 2) * laterPages,
	})
	const pages = 1 + Math.ceil(Math.max(total - firstPage, 0) / laterPages)
	checkPages(pages)

	return { posts, page, pages, total, today: dateline(new Date()) }
}
