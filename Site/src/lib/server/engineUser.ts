import { createHash } from "node:crypto"
import { db } from "$lib/server/surreal"

/**
 * The numeric UserId given to the Aya engine for a Mercury account (Mercury user
 * IDs are strings). Stable, so DataStores, badges and game passes follow the
 * account across sessions.
 */
export const engineUserId = (username: string) =>
	(createHash("sha1").update(username).digest().readUInt32BE(0) % 2147483646) + 1

type EngineUser = { id: string; username: string }

let byEngineId = new Map<number, EngineUser>()
let refreshed = 0

async function refresh() {
	const [users] = await db.query<[EngineUser[]]>(
		"SELECT record::id(id) AS id, username FROM user"
	)
	byEngineId = new Map(users.map(u => [engineUserId(u.username), u]))
	refreshed = Date.now()
}

/**
 * Finds the Mercury account behind an engine UserId (from a gameserver or the
 * Player). New accounts are picked up by refreshing on a miss, at most every 5s.
 */
export async function userFromEngineId(engineId: number) {
	if (!Number.isSafeInteger(engineId) || engineId < 1) return
	let user = byEngineId.get(engineId)
	if (!user && Date.now() - refreshed > 5000) {
		await refresh()
		user = byEngineId.get(engineId)
	}
	return user
}
