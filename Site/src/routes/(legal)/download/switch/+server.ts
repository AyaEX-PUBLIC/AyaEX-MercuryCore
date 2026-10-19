import { error } from "@sveltejs/kit"
import { clientFile, clients } from "$lib/server/downloads"

export async function GET() {
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
