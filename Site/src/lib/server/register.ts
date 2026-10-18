// Account registration with a recovery phrase (lib/phrase.ts): checking the
// details first, so problems show before the player writes their phrase
// down, then creating the account with the phrase's public key.

import { sendRegistrationDiscordWebhook } from "$lib/server/discordModerationWebhook"
import config from "$lib/server/config"
import requestRender from "$lib/server/requestRender"
import { db, findWhere, Record, type RecordId } from "$lib/server/surreal"
import { usernameTest } from "$lib/typeTests"
import { type } from "arktype"
import createUserQuery from "./createUser.surql"
import regkeyCheckQuery from "./regkeyCheck.surql"

export type Details = { username: string; email?: string; regkey?: string }
type Field = keyof Details

const prefix = config.Registration.Keys.Prefix
const prefixRegex = new RegExp(`^${prefix}(.+)$`)
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
	if (await findWhere("user", "username = $username", { username }))
		return fail("username", "This username is already in use")

	// the very first account is the administrator, and needs no key
	const initial = !(await accountRegistered())
	if (initial) return { initial, discord: {} }

	if (config.Registration.Emails) {
		if (!email || email.length > 320 || !emailTest.test(email))
			return fail("email", "Enter a valid email address")
		if (await findWhere("user", "email = $email", { email }))
			return fail("email", "This email is already in use")
	}

	if (!config.Registration.Keys.Enabled) return { initial, discord: {} }

	const matched = regkey?.match(prefixRegex)
	if (!matched || regkey.length > 200)
		return fail("regkey", "Registration key is invalid")
	const key = Record("regKey", matched[1])
	const [[check]] = await db.query<
		{
			usesLeft: number
			expiry?: Date | string | null
			discordId?: string
			discordName?: string
		}[][]
	>(regkeyCheckQuery, { key })
	if (!check) return fail("regkey", "Registration key is invalid")
	if (check.usesLeft < 1)
		return fail("regkey", "This registration key has ran out of uses")
	if (check.expiry && new Date(check.expiry).getTime() < Date.now())
		return fail("regkey", "This registration key has expired")

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
	const [, user] = await db.query<RecordId<"user">[]>(createUserQuery, {
		username,
		email: (config.Registration.Emails && email) || "",
		authKey: publicKey,
		permissionLevel: checked.initial ? 5 : 1,
		bodyColours: config.DefaultBodyColors,
		key: checked.key,
	})

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
