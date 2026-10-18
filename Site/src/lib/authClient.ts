// Browser side of /api/auth (routes/api/auth/+server.ts)

import { keyFromPhrase, type Purpose } from "$lib/phrase"

/**
 * Sends an operation to /api/auth.
 * @returns The response's data. Throws an Error with the server's message if it failed.
 */
export async function authApi<T = { ok: boolean }>(
	op: string,
	body: object = {}
): Promise<T> {
	const res = await fetch("/api/auth", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...body, op }),
	})
	const data = await res.json().catch(() => ({}))
	if (!res.ok)
		throw new Error(data.message || "Something went wrong, try again")
	return data
}

/** Gets a challenge for a purpose and signs it with a phrase's key */
export async function answer(phrase: string, purpose: Purpose) {
	const key = await keyFromPhrase(phrase)
	const { nonce } = await authApi<{ nonce: string }>("challenge", { purpose })
	return {
		publicKey: key.publicKey,
		nonce,
		signature: key.sign(purpose, nonce),
	}
}
