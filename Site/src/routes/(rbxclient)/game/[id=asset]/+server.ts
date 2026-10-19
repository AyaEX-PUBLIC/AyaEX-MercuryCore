import { error } from "@sveltejs/kit"
import { requirePlaceFileAccess } from "$lib/server/assetAuth"
import { find } from "$lib/server/surreal"

export async function GET({ locals, params, request, url }) {
	const id = +params.id
	if (!(await find("place", id))) error(404, "Not Found")
	await requirePlaceFileAccess(
		locals,
		request,
		id,
		url.searchParams.get("token")
	)

	const file = Bun.file(`../data/places/${id}`)
	if (!(await file.exists())) return error(404, "File not found")

	return new Response(file)
}
