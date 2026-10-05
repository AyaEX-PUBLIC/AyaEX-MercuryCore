import { type } from "arktype"
import { query } from "$app/server"
import { bodyPartTypes } from "$lib/assetTypes"
import { db } from "$lib/server/surreal"
import type { Asset } from "./+page.server"
import catalogQuery from "./catalog.surql"

export const getAssets = query(
	type({
		type: type.enumerated(2, 8, 11, 12, 13, 17, 18, 19, 27),
		page: type("number.integer >= 1"),
	}),
	async args => {
		// the Body Parts tab (27) lists every body part slot
		const types = args.type === 27 ? bodyPartTypes : [args.type]
		const [assets, pages] = await db.query<[Asset[], number]>(
			catalogQuery,
			{ ...args, types }
		)

		// track https://github.com/sveltejs/kit/issues/14398 and https://github.com/sveltejs/kit/issues/14932

		return { assets, pages }
	}
)
