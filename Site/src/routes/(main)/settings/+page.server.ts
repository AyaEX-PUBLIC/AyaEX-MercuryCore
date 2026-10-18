import { redirect } from "@sveltejs/kit"
import { dev } from "$app/environment"
import { type } from "arktype"
import {
	clientChannelCookie,
	clientChannelInfo,
	clientChannels,
} from "$lib/clientChannels"
import { authorise, cookieName, invalidateAllSessions } from "$lib/server/auth"
import config from "$lib/server/config"
import formError from "$lib/server/formError"
import { db, Record } from "$lib/server/surreal"
import { arktype, message, superValidate } from "$lib/server/validate"
import updateProfileQuery from "./updateProfile.surql"

const themeNames = config.Themes.map(t => t.Name)

const profileSchema = type({
	description: "(string <= 1000) | undefined",
	theme: type.enumerated(...themeNames).pipe.try(t => {
		const index = themeNames.indexOf(t)
		if (index === -1) throw new Error("must be a valid theme")
		return index
	}),
})
const stylingSchema = type({
	css: "(string <= 10000) | undefined",
})
const clientSchema = type({
	channel: type.enumerated(...clientChannels),
})

export const load = async () => ({
	profileForm: await superValidate(arktype(profileSchema)),
	stylingForm: await superValidate(arktype(stylingSchema)),
	clientForm: await superValidate(arktype(clientSchema)),
	themes: themeNames,
	clientChannels,
	clientChannelInfo,
})

export const actions: import("./$types").Actions = {}
actions.profile = async ({ locals, request }) => {
	const { user } = await authorise(locals)
	const form = await superValidate(request, arktype(profileSchema))
	if (!form.valid) return formError(form)

	const { description, theme } = form.data

	await db.query(updateProfileQuery, {
		user: Record("user", user.id),
		description,
		theme,
	})

	return message(form, "Profile updated successfully!")
}
// Recovery phrases are replaced through /api/auth (Security.svelte)
actions.sessions = async ({ cookies, locals }) => {
	const { user } = await authorise(locals)

	await invalidateAllSessions(user.id)
	cookies.delete(cookieName, { path: "/" })

	redirect(302, "/login")
}
actions.styling = async ({ locals, request }) => {
	const { user } = await authorise(locals)
	const form = await superValidate(request, arktype(stylingSchema))
	if (!form.valid) return formError(form)

	const { css } = form.data
	if (css === "undefined") return message(form, "Styling already saved!")

	await db.update(Record("user", user.id)).merge({ css })

	return message(form, "Styling updated successfully!")
}
actions.client = async ({ cookies, locals, request }) => {
	const { user } = await authorise(locals)
	const form = await superValidate(request, arktype(clientSchema))
	if (!form.valid) return formError(form)

	const { channel } = form.data
	await db.update(Record("user", user.id)).merge({ clientChannel: channel })
	// the hook syncs this on the next request; set it now for an immediate Play
	cookies.set(clientChannelCookie, channel, {
		secure: !dev,
		httpOnly: true,
		sameSite: "lax",
		maxAge: 365 * 24 * 60 * 60,
		path: "/",
	})

	return message(form, `Client channel set to ${channel}.`)
}
