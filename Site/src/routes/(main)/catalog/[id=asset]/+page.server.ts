import { error, redirect } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { db, Record } from "$lib/server/surreal"
import { encode } from "$lib/urlName"
import assetQuery from "./asset.surql"

export async function load({ locals, params }) {
	// not only in the (main) layout: SvelteKit skips its load for __data.json
	// requests that don't ask for it
	const { user } = await authorise(locals)
	const { id } = params
	const [[asset]] = await db.query<
		{ name: string; visibility: string; isCreator: boolean }[][]
	>(assetQuery, {
		asset: Record("asset", +id),
		user: Record("user", user.id),
	})
	if (!asset) error(404, "Not Found")
	if (
		asset.visibility !== "Visible" &&
		!asset.isCreator &&
		user.permissionLevel < 3
	)
		error(404, "Not Found")

	const slug = encode(asset.name)
	redirect(302, `/catalog/${id}/${slug}`)
}
