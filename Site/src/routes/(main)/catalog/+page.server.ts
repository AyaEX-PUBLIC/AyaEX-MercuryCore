import pageQuery from "$lib/server/pageQuery"

export type Asset = {
	name: string
	price: number
	id: number
}

export function load({ url }) {
	// only normalises ?p (e.g. below 1): each tab loads its own items and page
	// count through getAssets (data.remote.ts), which knows the tab's types
	pageQuery(url)
}
