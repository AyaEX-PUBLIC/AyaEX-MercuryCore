import { redirect } from "@sveltejs/kit"
import { type } from "arktype"
import { cookieName, cookieOptions, createSession } from "$lib/server/auth"
import formError from "$lib/server/formError"
import { inviteSettings } from "$lib/server/invites"
import { passwordSignIn } from "$lib/server/phrase"
import { accountRegistered } from "$lib/server/register"
import { db, type RecordId } from "$lib/server/surreal"
import { arktype, superValidate } from "$lib/server/validate"
import { usernameTest } from "$lib/typeTests"
import userQuery from "./user.surql"

// Accounts sign in with their recovery phrase (/api/auth). Until an
// administrator ends password sign-in, accounts without a phrase can sign in
// with their password once, to make one (the hooks send them to /migrate).
const schema = type({
	username: usernameTest,
	password: "1 <= string <= 6969",
})

export const load = async () => ({
	form: await superValidate(arktype(schema)),
	users: await accountRegistered(),
	passwordSignIn: await passwordSignIn(),
	apply: await inviteSettings().then(
		s => s.applications && s.registration === "invite"
	),
})

// Wrong passwords lock an account's password sign-in for a while. This is
// per account, as the Site can't tell visitors' IP addresses apart.
const maxFailures = 5
const lockTime = 10 * 60e3
const failures = new Map<string, { count: number; until: number }>()

export const actions: import("./$types").Actions = {}
actions.password = async ({ cookies, request }) => {
	const form = await superValidate(request, arktype(schema))
	if (!form.valid) return formError(form)

	const { username, password } = form.data
	form.data.password = ""

	if (!(await passwordSignIn()))
		return formError(
			form,
			["password"],
			[
				"Password sign-in has ended. Ask an administrator for a reset code.",
			]
		)

	const now = Date.now()
	for (const [name, f] of failures) if (f.until < now) failures.delete(name)
	const name = username.toLowerCase()
	const failed = failures.get(name)
	if (failed && failed.count >= maxFailures)
		return formError(
			form,
			["password"],
			["Too many wrong passwords. Try again in 10 minutes."]
		)

	const [[user]] = await db.query<
		{
			id: RecordId<"user">
			hashedPassword?: string
		}[][]
	>(userQuery, { username })

	// accounts with a phrase have no password any more
	// remove this statement and we'll end up like Mercury 1 💀
	if (
		!user?.hashedPassword ||
		!Bun.password.verifySync(password, user.hashedPassword)
	) {
		// (only real accounts, so made-up names can't fill the map)
		if (user)
			failures.set(name, {
				count: (failed?.count || 0) + 1,
				until: now + lockTime,
			})
		return formError(
			form,
			["username", "password"],
			[" ", "Incorrect username or password"] // Don't give any extra information which may be useful to attackers
		)
	}
	failures.delete(name)

	cookies.set(cookieName, await createSession(user.id), cookieOptions)

	redirect(302, "/migrate")
}
