import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"
import { db, Record } from "$lib/server/surreal"
import inventoryQuery from "./inventory.surql"
import { currentTab, inventoryTabs } from "./tabs"

type Asset = {
	name: string
	price: number
	id: number
	type: number
}

export async function load({ locals, url }) {
	const { user } = await authorise(locals)
	const { page, checkPages } = pageQuery(url)

	// each tab is paged on its own (?tab=, kept in the URL by the page)
	const [assets, pages] = await db.query<[Asset[], number]>(inventoryQuery, {
		user: Record("user", user.id),
		types: inventoryTabs[currentTab(url, inventoryTabs)],
		page,
	})
	checkPages(pages)

	return { assets, pages, tabs: Object.keys(inventoryTabs) }
}
