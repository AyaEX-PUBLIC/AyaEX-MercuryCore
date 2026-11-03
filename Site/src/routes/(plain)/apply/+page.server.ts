import { fail, isHttpError } from "@sveltejs/kit"
import { type } from "arktype"
import { readFormData } from "$lib/server/body"
import { applicationSchema, apply, inviteSettings } from "$lib/server/invites"
import { rateLimit } from "$lib/server/requestRateLimit"

// Applications are small text posts: 64KB is far more than the schema needs,
// and is enforced while the body streams, not after formData() has buffered it
const applyBodyLimit = 64_000

// Applying to join, for people without an invite (lib/server/invites.ts)
export async function load() {
	const settings = await inviteSettings()
	return {
		open: settings.applications && settings.registration === "invite",
		question: settings.question,
	}
}

export const actions: import("./$types").Actions = {}
actions.default = async event => {
	// Caddy also limits this path; this is the limit that holds without it
	rateLimit(event, "applyForm", {
		burst: 5,
		perSecond: 1 / 600,
		siteBurst: 20,
		sitePerSecond: 1 / 180,
	})

	const form = await readFormData(event.request, applyBodyLimit)
	const input = {
		username: String(form.get("username") || "").trim(),
		about: String(form.get("about") || ""),
		contact: String(form.get("contact") || ""),
	}
	const checked = applicationSchema(input)
	if (checked instanceof type.errors)
		return fail(400, { ...input, error: checked.summary })
	try {
		return { code: await apply(checked) }
	} catch (e) {
		if (isHttpError(e))
			return fail(e.status, { ...input, error: e.body.message })
		throw e
	}
}
