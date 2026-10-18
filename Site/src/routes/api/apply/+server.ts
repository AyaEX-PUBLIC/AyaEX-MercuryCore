// An application's status, for its applicant: the code is sent in the body
// (from the status page's URL fragment), so it never shows up in URLs or logs

import { error, json } from "@sveltejs/kit"
import { applicationStatus } from "$lib/server/invites"

export async function POST({ request }) {
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		error(415, "Expected JSON")
	const { code } = await request.json().catch(() => ({}))
	const status = await applicationStatus(String(code || ""))
	if (!status) error(404, "No application has that code")
	return json(status, { headers: { "Cache-Control": "no-store" } })
}
