// Device sign-in, for the Switch app (routes/api/switch), which has no good
// way to type a recovery phrase. The device asks for a short code and shows
// it; a signed-in player approves the code on /device; the device, polling
// with a secret token only it has, then gets its own session.

import { createHash } from "node:crypto"
import { error } from "@sveltejs/kit"
import { randomCode } from "$lib/server/resetCode"
import { db, Record, type RecordId } from "$lib/server/surreal"

/** How long a code can be approved for, in seconds */
export const deviceCodeLifetime = 10 * 60

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")
const normalise = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "")

// One limit for the whole Site, as it can't tell visitors' IP addresses apart
const starts = { tokens: 30, at: Date.now() }

/** A new code for a device to show, and the token it polls with */
export async function startDevice() {
	const now = Date.now()
	starts.tokens = Math.min(30, starts.tokens + (now - starts.at) / 2000)
	starts.at = now
	if (starts.tokens < 1)
		error(429, "Too many sign-in codes, try again shortly")
	starts.tokens--

	const code = randomCode(8) // 40 bits, for 10 minutes
	const token = Buffer.from(
		crypto.getRandomValues(new Uint8Array(32))
	).toString("base64url")
	await db.query(
		`DELETE deviceCode WHERE expires < time::now();
		CREATE deviceCode SET code = $code, tokenHash = $hash,
			expires = time::now() + <duration>$lifetime;`,
		{
			code: normalise(code),
			hash: sha256(token),
			lifetime: `${deviceCodeLifetime}s`,
		}
	)
	return { code, token }
}

/**
 * What's happened to a device's code.
 * @returns The approving account once, after which the code is gone.
 */
export async function pollDevice(token: string) {
	if (typeof token !== "string" || token.length > 100)
		return { status: "expired" } as const
	const [, , found] = await db.query<
		({ expires: Date; user?: RecordId<"user"> } | undefined)[]
	>(
		`LET $found = (SELECT * FROM deviceCode WHERE tokenHash = $hash LIMIT 1)[0];
		IF $found AND ($found.user OR $found.expires < time::now()) {
			DELETE $found.id;
		};
		$found;`,
		{ hash: sha256(token) }
	)
	// approved codes expire too: an unredeemed approval mustn't outlive its code
	if (!found || found.expires.getTime() < Date.now())
		return { status: "expired" } as const
	if (!found.user) return { status: "pending" } as const
	return { status: "approved", user: found.user } as const
}

/** Approves a device's code for an account. @returns Whether the code was waiting. */
export async function approveDevice(code: string, user: string) {
	if (code.length > 40) return false
	const [approved] = await db.query<unknown[][]>(
		`UPDATE deviceCode SET user = $user
		WHERE code = $code AND !user AND expires > time::now()
		RETURN VALUE 1`,
		{ code: normalise(code), user: Record("user", user) }
	)
	return approved.length > 0
}
