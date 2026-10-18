// Codes that let someone make a new recovery phrase (lib/phrase.ts) when
// they've lost theirs: given out by an administrator, or emailed if emails
// are set up. Only a hash of each code is stored, and a code works once.

import { createHash } from "node:crypto"
import { db, Record, type RecordId } from "$lib/server/surreal"

// no 0/O or 1/I, so codes can be read out or copied by hand
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Random letters and numbers from the alphabet above, in groups of 4 */
export function randomCode(length: number) {
	const bytes = crypto.getRandomValues(new Uint8Array(length))
	const chars = Array.from(bytes, b => alphabet[b % alphabet.length])
	return chars.join("").replace(/(.{4})(?!$)/g, "$1-")
}

const hash = (code: string) =>
	createHash("sha256")
		.update(code.toUpperCase().replace(/[^A-Z0-9]/g, ""))
		.digest("hex")

/**
 * Makes a reset code for an account, replacing any it had before.
 * @returns The code, to show or send once.
 */
export async function issueResetCode(user: RecordId<"user">) {
	const code = randomCode(12) // 60 bits
	await db.query(
		`UPDATE recoveryCode SET used = true WHERE user = $user AND !used;
		CREATE recoveryCode SET user = $user, code = $hash;`,
		{ user, hash: hash(code) }
	)
	return code
}

/** The account an unused, unexpired reset code is for */
export async function findResetCode(code: string) {
	if (code.length > 40) return
	const [[found]] = await db.query<{ id: string; username: string }[][]>(
		`SELECT record::id(user) AS id, user.username AS username FROM recoveryCode
		WHERE code = $hash AND !used AND expires > time::now() LIMIT 1`,
		{ hash: hash(code) }
	)
	return found
}

/** Uses up a reset code, and any others the account had */
export const useResetCode = (user: string) =>
	db.query("UPDATE recoveryCode SET used = true WHERE user = $user", {
		user: Record("user", user),
	})
