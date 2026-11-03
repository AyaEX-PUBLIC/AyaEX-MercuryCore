import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"
import { db } from "$lib/server/surreal"
import searchAssetsQuery from "./searchAssets.surql"
import searchGroupsQuery from "./searchGroups.surql"
import searchPlacesQuery from "./searchPlaces.surql"
import searchUsersQuery from "./searchUsers.surql"

type Place = {
	id: number
	name: string
	playerCount: number
	serverPing: number
	likeCount: number
	dislikeCount: number
}

type Asset = {
	id: number
	name: string
	price: number
}

type Group = {
	id: string
	name: string
	memberCount: number
}

// results on a page: fills rows of 2 to 6
const pageSize = 60

export async function load({ locals, url }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	await authorise(locals)
	const query = url.searchParams.get("q") || ""
	const category = url.searchParams.get("c")?.toLowerCase() || ""
	if (!query) error(400, "Missing search query")

	const { page, checkPages } = pageQuery(url)

	// just freeze it bruh
	const param = Object.freeze({ query, page })

	// a page of results, and how many pages there are
	async function search<T>(searchQuery: string) {
		const [results, count] = await db.query<[T[], number]>(searchQuery, param)
		const pages = Math.max(1, Math.ceil(count / pageSize))
		checkPages(pages)
		return { results, pages }
	}

	// TODO: make this full-text search because that would be much nicer
	switch (category) {
		case "users": {
			// convenient, but easy to abuse
			// const foundUser = await findWhere(
			// 	"user",
			// 	"username = $query",
			// 	param
			// )
			// if (foundUser) redirect(302, `/user/${query}`)

			const { results: users, pages } =
				await search<BasicUser>(searchUsersQuery)
			return { query, category, users, totalPages: pages }
		}
		case "places": {
			const { results: places, pages } =
				await search<Place>(searchPlacesQuery)
			return { query, category, places, totalPages: pages }
		}
		case "assets": {
			const { results: assets, pages } =
				await search<Asset>(searchAssetsQuery)
			return { query, category, assets, totalPages: pages }
		}
		case "groups": {
			const { results: groups, pages } =
				await search<Group>(searchGroupsQuery)
			return { query, category, groups, totalPages: pages }
		}
	}
	error(400, "Invalid category")
}
