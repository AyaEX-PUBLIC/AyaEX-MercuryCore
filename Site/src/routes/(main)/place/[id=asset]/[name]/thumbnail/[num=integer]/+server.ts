import { error } from "@sveltejs/kit"
import config from "$lib/server/config"
import { find } from "$lib/server/surreal"

const thumbnails = config.Images.DefaultPlaceThumbnails

export async function GET({ params }) {
	const id = +params.id
	if (!(await find("place", id))) error(404, "Not Found")

	// a thumbnail uploaded in the place settings replaces the defaults
	const custom = Bun.file(`../data/placethumbnails/${id}.avif`)
	if (await custom.exists())
		return new Response(custom, {
			headers: { "Content-Type": "image/avif", "Cache-Control": "no-cache" },
		})

	const num = +params.num
	if (num < 0 || num >= thumbnails.length) error(404, "Not Found")

	return new Response(Bun.file(`../Assets/${thumbnails[num]}`))
}
