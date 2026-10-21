// Recovery phrase sign-in on the server (lib/phrase.ts has the browser side):
// one-time challenges for keys to sign, setting an account's key, and the
// admin switch that ends password sign-in after the migration period.

import { timingSafeEqual } from "node:crypto"
import { ed25519 } from "@noble/curves/ed25519.js"
import { hexToBytes } from "@noble/hashes/utils.js"
import { error } from "@sveltejs/kit"
import { challengeMessage, type Purpose } from "$lib/phrase"
import { db, Record, type RecordId } from "$lib/server/surreal"

export const publicKeyTest = /^[0-9a-f]{64}$/
const signatureTest = /^[0-9a-f]{128}$/

// Challenges are stateless: a random value and expiry, with an HMAC that ties
// them to their purpose and user, so nobody can fill memory by asking for
// lots. Only answered ones are remembered, until they expire, so each can
// be used once. The key changes on restart, which voids open challenges.
const lifetime = 5 * 60e3
const macKey = await crypto.subtle.importKey(
	"raw",
	crypto.getRandomValues(new Uint8Array(32)),
	{ name: "HMAC", hash: "SHA-256" },
	false,
	["sign"]
)
const used = new Map<string, number>()

async function mac(body: string, purpose: Purpose, user: string | null) {
	const data = new TextEncoder().encode(`${body}|${purpose}|${user || ""}`)
	const sig = await crypto.subtle.sign("HMAC", macKey, data)
	return Buffer.from(sig).toString("base64url")
}

/**
 * A one-time challenge for a phrase key to sign.
 * @param purpose What the signature will be used for.
 * @param user The logged-in user asking, if any; only they can use it.
 */
export async function challenge(purpose: Purpose, user: string | null) {
	const random = Buffer.from(
		crypto.getRandomValues(new Uint8Array(16))
	).toString("base64url")
	const body = `${Date.now() + lifetime}.${random}`
	return `${body}.${await mac(body, purpose, user)}`
}

export type Answer = { publicKey: string; nonce: string; signature: string }

/**
 * Whether a challenge was signed by the given key. Each challenge can only
 * be used once.
 */
export async function verifyAnswer(
	answer: Answer,
	purpose: Purpose,
	user: string | null
) {
	const { publicKey, nonce, signature } = answer
	if (
		typeof nonce !== "string" ||
		nonce.length > 100 ||
		!publicKeyTest.test(publicKey) ||
		!signatureTest.test(signature)
	)
		return false

	const [expiry, random, given] = nonce.split(".")
	const expires = Number(expiry)
	const now = Date.now()
	if (!random || !given || !(expires > now) || used.has(nonce)) return false
	const expected = Buffer.from(
		await mac(`${expiry}.${random}`, purpose, user)
	)
	const actual = Buffer.from(given)
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
		return false

	// Claim the challenge now: nothing below awaits, so two answers to the same
	// challenge can't both get past the check above (it awaits the MAC).
	// Only a challenge this server signed gets this far, so junk nonces can't
	// fill the map
	if (used.has(nonce)) return false
	for (const [n, e] of used) if (e < now) used.delete(n)
	used.set(nonce, expires)

	let valid = false
	try {
		valid = ed25519.verify(
			hexToBytes(signature),
			challengeMessage(purpose, nonce),
			hexToBytes(publicKey)
		)
	} catch {}
	if (!valid) used.delete(nonce) // a bad signature doesn't use the challenge up
	return valid
}

/** The account a phrase key belongs to */
export async function userByKey(publicKey: string) {
	const [[user]] = await db.query<{ id: string; username: string }[][]>(
		"SELECT record::id(id) AS id, username FROM user WHERE authKey = $publicKey LIMIT 1",
		{ publicKey }
	)
	return user
}

/**
 * Gives an account a new phrase key. Its password (if it still had one) is
 * deleted, and it's signed out everywhere except the session given.
 */
export async function setKey(
	user: string,
	publicKey: string,
	keepSession?: string
) {
	const taken = () =>
		error(409, "That phrase already belongs to an account. Make a new one.")
	if (await userByKey(publicKey)) taken()

	try {
		await db.query(
			`UPDATE $user SET authKey = $publicKey, hashedPassword = NONE, phraseSet = time::now();
			DELETE session WHERE $user IN <-hasSession<-user AND id != $keep;
			DELETE deviceCode WHERE user = $user;`,
			{
				user: Record("user", user),
				publicKey,
				keep: Record("session", keepSession || "none"),
			}
		)
	} catch (e) {
		// the unique index, if two accounts tried the same key at once
		if ((e as Error).message.includes("userAuthKey")) taken()
		throw e
	}
}

/** Whether accounts without a phrase can still sign in with their password, to make one */
export async function passwordSignIn() {
	const [enabled] = await db.query<(boolean | null)[]>(
		"SELECT VALUE passwordSignIn FROM ONLY stuff:auth"
	)
	return enabled !== false
}

/** How far the move to phrases has got, for the admin panel */
export async function migrationStatus() {
	const [status] = await db.query<
		{
			passwordSignIn: boolean
			ended: Date | null
			total: number
			withPhrase: number
			withoutPhrase: string[]
		}[]
	>(
		`{
			passwordSignIn: (SELECT VALUE passwordSignIn FROM ONLY stuff:auth) != false,
			ended: (SELECT VALUE passwordsEnded FROM ONLY stuff:auth),
			total: count(SELECT 1 FROM user),
			withPhrase: count(SELECT 1 FROM user WHERE !!authKey),
			# (not authKey = NONE: that asks the authKey index, which leaves out NONE)
			withoutPhrase: (SELECT username, created FROM user WHERE !authKey ORDER BY created DESC).username,
		}`
	)
	return status
}

/**
 * Ends password sign-in for good: deletes every remaining password. Accounts
 * without a phrase then need a reset code from an administrator.
 * @returns How many passwords were deleted.
 */
export async function endPasswordSignIn(admin: RecordId<"user">) {
	const [, , deleted] = await db.query<number[]>(
		`UPSERT stuff:auth SET passwordSignIn = false, passwordsEnded = time::now();
		LET $deleted = count(UPDATE user SET hashedPassword = NONE WHERE hashedPassword != NONE);
		$deleted;
		fn::auditLog("Administration", string::concat("End password sign-in (", <string>$deleted, " passwords deleted)"), $admin);`,
		{ admin }
	)
	return deleted
}
