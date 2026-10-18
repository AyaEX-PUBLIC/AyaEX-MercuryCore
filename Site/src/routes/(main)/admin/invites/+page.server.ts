import { fail, isHttpError } from "@sveltejs/kit"
import { type } from "arktype"
import { authorise } from "$lib/server/auth"
import {
	inviteSettings,
	inviteStats,
	inviteTree,
	listApplications,
	reviewApplication,
	saveSettings,
	setRevoked,
	settingsSchema,
} from "$lib/server/invites"

// The invite system (lib/server/invites.ts). Moderators review applications
// and look after the tree; only administrators change the settings.
export async function load({ locals }) {
	const { user } = await authorise(locals, 4)
	const [settings, applications, tree, stats] = await Promise.all([
		inviteSettings(),
		listApplications(),
		inviteTree(),
		inviteStats(),
	])
	return {
		settings,
		applications,
		tree,
		stats,
		canConfigure: user.permissionLevel === 5,
	}
}

/** Turns an HTTP error from lib/server/invites.ts into a form failure */
async function attempt<T extends object>(
	task: () => Promise<unknown>,
	extra: T
) {
	try {
		await task()
	} catch (e) {
		if (!isHttpError(e)) throw e
		return fail(e.status, { error: e.body.message, ...extra })
	}
}

export const actions: import("./$types").Actions = {}
actions.settings = async ({ locals, request }) => {
	const { user } = await authorise(locals, 5)
	const data = await request.formData()
	const field = (name: string) => data.get(name)?.toString().trim() || ""
	const number = (name: string) => Number(field(name) || 0)
	const settings = settingsSchema({
		registration: field("registration"),
		purchases: data.has("purchases"),
		price: number("price"),
		perUserWeekly: number("perUserWeekly"),
		siteWeekly: number("siteWeekly"),
		minAccountDays: number("minAccountDays"),
		expiryDays: number("expiryDays"),
		applications: data.has("applications"),
		// one line of plain text
		question: field("question")
			.replace(/[\p{Cc}\p{Cf}\p{Co}]/gu, "")
			.replace(/\s+/g, " "),
		treePublic: data.has("treePublic"),
	})
	if (settings instanceof type.errors)
		return fail(400, { settingsError: settings.summary })

	await saveSettings(settings, user.id)
	return { saved: true }
}

actions.review = async ({ locals, request }) => {
	const { user } = await authorise(locals, 4)
	const data = await request.formData()
	const id = data.get("id")?.toString() || ""
	const decision = data.get("decision")
	if (decision !== "approve" && decision !== "reject")
		return fail(400, { error: "Approve or reject it" })
	const note = data.get("note")?.toString() || ""

	return (
		(await attempt(
			() => reviewApplication(id, decision === "approve", note, user.id),
			{ reviewed: id }
		)) || { reviewed: id }
	)
}

actions.revoke = async ({ locals, request }) => {
	const { user } = await authorise(locals, 4)
	const data = await request.formData()
	const username = data.get("username")?.toString() || ""
	const revoked = data.get("revoked") === "true"

	return (
		(await attempt(() => setRevoked(username, revoked, user), {
			revokedUser: username,
		})) || { revokedUser: username, revoked }
	)
}
