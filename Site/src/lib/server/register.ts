// Account registration with a recovery phrase (lib/phrase.ts): checking the
// details first, so problems show before the player writes their phrase
// down, then creating the account with the phrase's public key.

import { error } from "@sveltejs/kit"
import { type } from "arktype"
import config from "$lib/server/config"
import { sendRegistrationDiscordWebhook } from "$lib/server/discordModerationWebhook"
import { engineIdTaken } from "$lib/server/engineUser"
import { inviteSettings } from "$lib/server/invites"
import oneAtATime from "$lib/server/oneAtATime"
import requestRender from "$lib/server/requestRender"
import { db, findWhere, Record, type RecordId } from "$lib/server/surreal"
import { usernameTest } from "$lib/typeTests"
import createUserQuery from "./createUser.surql"
import regkeyCheckQuery from "./regkeyCheck.surql"

export type Details = { username: string; email?: string; regkey?: string }
type Field = keyof Details

/**
 * Whether a username is in use, ignoring case, or would get the same engine
 * UserId as an existing account (which would let it pass as that account in
 * games).
 */
async function usernameTaken(username: string) {
	return (
		(await findWhere(
			"user",
			"string::lowercase(username) = string::lowercase($username)",
			{ username }
		)) || (await engineIdTaken(username))
	)
}

// keys handed out before the prefix was renamed still work
const prefixes = [
	config.Registration.Keys.Prefix,
	...(config.Registration.Keys.OldPrefixes || []),
].map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
const prefixRegex = new RegExp(`^(?:${prefixes.join("|")})(.+)$`)
const emailTest = /^.+@.+$/

export async function accountRegistered() {
	const [registered] = await db.query<boolean[]>(
		"count(SELECT 1 FROM user) > 0"
	)
	return registered
}

type Checked =
	| { errors: { [_ in Field]?: string } }
	| {
			errors?: undefined
			initial: boolean
			key?: RecordId<"regKey">
			discord: { discordId?: string; discordName?: string }
	  }

/**
 * Checks registration details, without using anything up.
 * @returns Errors by field, or what's needed to create the account.
 */
export async function checkDetails({
	username,
	email,
	regkey,
}: Details): Promise<Checked> {
	const fail = (field: Field, message: string) => ({
		errors: { [field]: message },
	})

	const name = usernameTest(username)
	if (name instanceof type.errors) return fail("username", name.summary)
	if (await usernameTaken(username))
		return fail("username", "This username is already in use")

	// the very first account is the administrator, and needs no key
	const initial = !(await accountRegistered())
	if (initial) return { initial, discord: {} }

	// Admin > Invites decides who can register
	const { registration } = await inviteSettings()
	if (registration === "closed")
		return fail("username", "Registration is closed right now")

	if (config.Registration.Emails) {
		if (!email || email.length > 320 || !emailTest.test(email))
			return fail("email", "Enter a valid email address")
		if (await findWhere("user", "email = $email", { email }))
			return fail("email", "This email is already in use")
	}

	// open registration needs no invite, but one still puts you in the invite tree
	if (registration === "open" && !regkey) return { initial, discord: {} }

	const matched = regkey?.match(prefixRegex)
	if (!matched || regkey.length > 200)
		return fail("regkey", "That invite code isn't right")
	const key = Record("regKey", matched[1])
	const [[check]] = await db.query<
		{
			usesLeft: number
			expiry?: Date | string | null
			discordId?: string
			discordName?: string
		}[][]
	>(regkeyCheckQuery, { key })
	if (!check) return fail("regkey", "That invite code isn't right")
	if (check.usesLeft < 1)
		return fail("regkey", "This invite has already been used")
	if (check.expiry && new Date(check.expiry).getTime() < Date.now())
		return fail("regkey", "This invite has expired")

	return { initial, key, discord: check }
}

/** Creates an account that signs in with the given phrase key */
export async function createAccount(
	f: typeof fetch,
	details: Details,
	checked: Exclude<Checked, { errors: object }>,
	publicKey: string
) {
	const { username, email } = details
	let user: RecordId<"user">
	try {
		// one at a time, as SurrealDB can let two racing transactions both
		// take an invite's last use. BEGIN, IF, LET, then the user
		;[, , , user] = await oneAtATime("registration", async () => {
			// checked again here, as two registrations may race
			if (await usernameTaken(username))
				error(409, "This username is already in use")
			// the first account is the administrator and needs no invite: if
			// another one got there first, this one isn't the first any more
			if (checked.initial && (await accountRegistered()))
				error(409, "Someone else just made the first account. Try again.")
			return db.query<RecordId<"user">[]>(createUserQuery, {
				username,
				email: (config.Registration.Emails && email) || "",
				authKey: publicKey,
				permissionLevel: checked.initial ? 5 : 1,
				bodyColours: config.DefaultBodyColors,
				key: checked.key,
			})
		})
	} catch (e) {
		if (String(e).includes("invite has already been used"))
			error(409, "Someone just used that invite. Ask for another one.")
		throw e
	}

	try {
		await requestRender(f, "Avatar", user.id.toString(), username)
	} catch {}

	void sendRegistrationDiscordWebhook({
		username,
		initialAccount: checked.initial,
		regKey: checked.key ? String(checked.key.id) : undefined,
		...checked.discord,
	})

	return user
}
