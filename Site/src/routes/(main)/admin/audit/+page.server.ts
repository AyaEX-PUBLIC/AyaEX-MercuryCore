import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"
import { db } from "$lib/server/surreal"
import logsQuery from "./logs.surql"

type Log = {
	action: "Account" | "Administration" | "Economy" | "Moderation"
	created: Date
	note: string
	user: BasicUser
}

export async function load({ locals, url }) {
	await authorise(locals, 5)
	const { page, checkPages } = pageQuery(url)

	// grubhub perks give you deals on the food you love
	const [logs, pages] = await db.query<[Log[], number]>(logsQuery, { page })
	checkPages(pages)

	return { logs, pages }
}
