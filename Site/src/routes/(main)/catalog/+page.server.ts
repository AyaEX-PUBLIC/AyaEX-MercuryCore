import { authorise } from "$lib/server/auth"
import pageQuery from "$lib/server/pageQuery"

export type Asset = {
	name: string
	price: number
	id: number
}

export async function load({ locals, url }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	await authorise(locals)
	// only normalises ?p (e.g. below 1): each tab loads its own items and page
	// count through getAssets (data.remote.ts), which knows the tab's types
	pageQuery(url)
}
