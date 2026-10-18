import { fail, isHttpError } from "@sveltejs/kit"
import { type } from "arktype"
import { applicationSchema, apply, inviteSettings } from "$lib/server/invites"

// Applying to join, for people without an invite (lib/server/invites.ts)
export async function load() {
	const settings = await inviteSettings()
	return {
		open: settings.applications && settings.registration === "invite",
		question: settings.question,
	}
}

export const actions: import("./$types").Actions = {}
actions.default = async ({ request }) => {
	const form = await request.formData()
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
