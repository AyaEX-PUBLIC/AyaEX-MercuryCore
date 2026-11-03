// An application's status, for its applicant: the code is sent in the body
// (from the status page's URL fragment), so it never shows up in URLs or logs

import { error, json } from "@sveltejs/kit"
import { readText } from "$lib/server/body"
import { applicationStatus } from "$lib/server/invites"
import { rateLimit } from "$lib/server/requestRateLimit"

// only a { code } object fits in this
const bodyLimit = 4_000

export async function POST(event) {
	const { request } = event
	rateLimit(event, "applyStatus", {
		burst: 30,
		perSecond: 1,
		siteBurst: 300,
		sitePerSecond: 10,
	})

	if (!request.headers.get("content-type")?.startsWith("application/json"))
		error(415, "Expected JSON")

	let data: { code?: unknown }
	try {
		data = JSON.parse(await readText(request, bodyLimit))
	} catch (e) {
		if ((e as { status?: number }).status) throw e
		error(400, "Invalid JSON")
	}
	if (!data || typeof data !== "object" || Array.isArray(data))
		error(400, "Invalid request")

	const status = await applicationStatus(String(data.code || ""))
	if (!status) error(404, "No application has that code")
	return json(status, { headers: { "Cache-Control": "no-store" } })
}
