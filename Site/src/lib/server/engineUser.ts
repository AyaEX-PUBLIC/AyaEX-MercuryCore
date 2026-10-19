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
	const [users] = await db.query<[(EngineUser & { created: string })[]]>(
		"SELECT record::id(id) AS id, username, created FROM user ORDER BY created"
	)
	// Different usernames can hash to the same UserId. Registration refuses
	// those now (engineIdTaken), and for older accounts the first one keeps it.
	const map = new Map<number, EngineUser>()
	for (const { id, username } of users) {
		const engineId = engineUserId(username)
		const owner = map.get(engineId)
		if (owner)
			console.warn(
				`Engine UserId ${engineId} belongs to ${owner.username}, not ${username}`
			)
		else map.set(engineId, { id, username })
	}
	byEngineId = map
	refreshed = Date.now()
}

/** Whether another account already has the engine UserId this username would get */
export async function engineIdTaken(username: string) {
	await refresh()
	const owner = byEngineId.get(engineUserId(username))
	return !!owner && owner.username !== username
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
