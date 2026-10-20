import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { clientFile, clients } from "$lib/server/downloads"

// (endpoints don't run the (main) layout's check, so this one does its own)
export async function GET({ locals }) {
	await authorise(locals)
	const found = await clientFile("switch")
	if (!found) error(404, "The Switch client isn't available yet")
	return new Response(Bun.file(clients.switch.path), {
		headers: {
			"Content-Type": "application/octet-stream",
			"Content-Disposition": `attachment; filename="${found.name}"`,
			"Cache-Control": "no-cache",
		},
	})
}
