// Recovery phrase sign-in (lib/phrase.ts). The browser asks for a challenge,
// signs it with the key from the player's phrase, and sends the answer with
// one of these operations, as JSON:
//
//   challenge          { purpose }                    -> { nonce }
//   login              answer
//   checkRegistration  { username, email?, regkey? }  -> { initial } or { errors }
//   register           { username, email?, regkey?, ...answer }
//   setPhrase          answer               (signed in, no phrase yet)
//   checkPhrase        answer               (signed in: is this my phrase?)
//   replacePhrase      { current, next }    (answers for the old and new phrase)
//   checkReset         { code }                       -> { username }
//   reset              { code, ...answer }
//
// An answer is { publicKey, nonce, signature }.

import { error, json } from "@sveltejs/kit"
import type { Purpose } from "$lib/phrase"
import { readText } from "$lib/server/body"
import { cookieName, cookieOptions, createSession } from "$lib/server/auth"
import { rateLimit } from "$lib/server/requestRateLimit"
import {
	type Answer,
	challenge,
	setKey,
	userByKey,
	verifyAnswer,
} from "$lib/server/phrase"
import { checkDetails, createAccount, type Details } from "$lib/server/register"
import { findResetCode, useResetCode } from "$lib/server/resetCode"
import { db, Record } from "$lib/server/surreal"

const purposes: Purpose[] = ["login", "register", "phrase", "replace", "reset"]
// purposes that need the asker to be signed in
const signedInPurposes: Purpose[] = ["phrase", "replace"]

// Lookups that don't need a signature (registration and reset code checks)
// share a limit for the whole Site, as the Site can't tell visitors' IP
// addresses apart behind its proxies
const lookups = { tokens: 100, at: Date.now() }
function lookupLimit() {
	const now = Date.now()
	lookups.tokens = Math.min(100, lookups.tokens + (now - lookups.at) / 50)
	lookups.at = now
	if (lookups.tokens < 1) error(429, "Too many requests, try again shortly")
	lookups.tokens--
}

const answerOf = (data: Record<string, unknown>): Answer => ({
	publicKey: String(data.publicKey || ""),
	nonce: String(data.nonce || ""),
	signature: String(data.signature || ""),
})

const detailsOf = (data: Record<string, unknown>): Details => ({
	username: String(data.username || "").slice(0, 100),
	email: typeof data.email === "string" ? data.email : undefined,
	regkey: typeof data.regkey === "string" ? data.regkey : undefined,
})

const failed = () =>
	error(401, "That didn't work. Check your phrase and try again.")

const maxAuthBody = 8 * 1024

export async function POST(event) {
	const { request, locals, cookies, url, fetch } = event
	// Edge rate limits are in Caddyfile.aya; this one still applies when
	// the Site is reached directly or through another proxy
	rateLimit(event, "auth", {
		burst: 30,
		perSecond: 0.5,
		siteBurst: 200,
		sitePerSecond: 5,
	})

	const origin = request.headers.get("origin")
	if (origin && origin !== url.origin) error(403, "Invalid origin")
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		error(415, "Expected JSON")
	// count bytes from the stream: Content-Length can be missing or false
	const raw = await readText(request, maxAuthBody)
	let data: Record<string, unknown>
	try {
		data = JSON.parse(raw)
	} catch {
		error(400, "Invalid JSON")
	}
	if (!data || typeof data !== "object" || Array.isArray(data))
		error(400, "Invalid request")

	const { user, session } = locals
	const signIn = async (id: string) => {
		cookies.set(
			cookieName,
			await createSession(Record("user", id)),
			cookieOptions
		)
		return json({ ok: true })
	}

	switch (data.op) {
		case "challenge": {
			const purpose = data.purpose as Purpose
			if (!purposes.includes(purpose)) error(400, "Invalid purpose")
			const signedIn = signedInPurposes.includes(purpose)
			if (signedIn && !user) error(401, "You must be logged in")
			return json({
				nonce: await challenge(
					purpose,
					signedIn ? user?.id || null : null
				),
			})
		}

		case "login": {
			const answer = answerOf(data)
			if (!(await verifyAnswer(answer, "login", null))) failed()
			const found = await userByKey(answer.publicKey)
			if (!found)
				error(
					404,
					"No account uses this phrase. Check each word is right."
				)
			return await signIn(found.id)
		}

		case "checkRegistration": {
			if (user) error(400, "You're already signed in")
			lookupLimit()
			const checked = await checkDetails(detailsOf(data))
			if (checked.errors) return json({ errors: checked.errors })
			return json({ initial: checked.initial })
		}

		case "register": {
			if (user) error(400, "You're already signed in")
			const answer = answerOf(data)
			if (!(await verifyAnswer(answer, "register", null))) failed()
			const details = detailsOf(data)
			const checked = await checkDetails(details)
			if (checked.errors) return json({ errors: checked.errors })
			if (await userByKey(answer.publicKey))
				error(409, "That phrase already belongs to an account")
			const created = await createAccount(
				fetch,
				details,
				checked,
				answer.publicKey
			)
			return await signIn(String(created.id))
		}

		case "setPhrase": {
			if (!user || !session) error(401, "You must be logged in")
			if (user.hasPhrase)
				error(400, "You already have a phrase; replace it in Settings")
			const answer = answerOf(data)
			if (!(await verifyAnswer(answer, "phrase", user.id))) failed()
			await setKey(user.id, answer.publicKey, session)
			return json({ ok: true })
		}

		case "checkPhrase": {
			if (!user) error(401, "You must be logged in")
			const answer = answerOf(data)
			if (
				!(await verifyAnswer(answer, "replace", user.id)) ||
				(await userByKey(answer.publicKey))?.id !== user.id
			)
				error(401, "That isn't your current phrase")
			return json({ ok: true })
		}

		case "replacePhrase": {
			if (!user || !session) error(401, "You must be logged in")
			const current = answerOf(
				(data.current || {}) as Record<string, unknown>
			)
			const next = answerOf((data.next || {}) as Record<string, unknown>)
			if (!(await verifyAnswer(current, "replace", user.id)))
				error(401, "That isn't your current phrase")
			if ((await userByKey(current.publicKey))?.id !== user.id)
				error(401, "That isn't your current phrase")
			if (!(await verifyAnswer(next, "phrase", user.id))) failed()
			await setKey(user.id, next.publicKey, session)
			return json({ ok: true })
		}

		case "checkReset": {
			lookupLimit()
			const found = await findResetCode(String(data.code || ""))
			if (!found) error(404, "That code isn't valid, or has expired")
			return json({ username: found.username })
		}

		case "reset": {
			const answer = answerOf(data)
			if (!(await verifyAnswer(answer, "reset", null))) failed()
			lookupLimit()
			const found = await findResetCode(String(data.code || ""))
			if (!found) error(404, "That code isn't valid, or has expired")
			// signs the account out everywhere, then in here
			await setKey(found.id, answer.publicKey)
			await useResetCode(found.id)
			await db.run("fn::auditLog", [
				"Account",
				`Make a new recovery phrase with a reset code for ${found.username}`,
				Record("user", found.id),
			])
			return await signIn(found.id)
		}
	}
	error(400, "Unknown operation")
}
