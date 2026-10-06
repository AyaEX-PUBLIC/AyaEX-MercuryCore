import { createHash } from "node:crypto"
import { db, Record } from "$lib/server/surreal"

// Groups in game: each group has a numeric ID for the engine (IsInGroup,
// GetRankInGroup, GetRoleInGroup), either set on the group (engineId, e.g.
// the Administrators group's) or hashed from its record ID.

export type JoinMode = "open" | "invite" | "closed"
export const joinModes: { [_ in JoinMode]: string } = {
	open: "Anyone can join",
	invite: "Invite only",
	closed: "Closed: nobody new can join",
}

/** The engine's group ID for a group without a set engineId */
export const hashedGroupId = (id: string) =>
	(createHash("sha1").update(`group:${id}`).digest().readUInt32BE(0) % 999_999_999) + 1

type EngineGroup = { id: string; name: string; engineId?: number }

let byEngineId = new Map<number, EngineGroup>()
let refreshed = 0

async function refresh() {
	const [groups] = await db.query<[EngineGroup[]]>("SELECT record::id(id) AS id, name, engineId FROM group")
	byEngineId = new Map(groups.map(g => [g.engineId ?? hashedGroupId(g.id), g]))
	refreshed = Date.now()
}

/** Finds a group by its engine ID (new groups are picked up within 5s) */
export async function groupFromEngineId(engineId: number) {
	if (!Number.isSafeInteger(engineId) || engineId < 1) return
	if (Date.now() - refreshed > 5000) await refresh()
	return byEngineId.get(engineId)
}

/** Roblox-style rank: 255 for the owner, 1 for members, 0 otherwise */
export async function groupRank(user: string, group: string) {
	const [rank] = await db.query<[number]>(
		`RETURN IF $user IN $group<-ownsGroup<-user THEN 255
			ELSE IF $user IN $group<-member<-user THEN 1
			ELSE 0 END`,
		{ user: Record("user", user), group: Record("group", group) }
	)
	return rank
}

export const roleName = (rank: number) => (rank === 255 ? "Owner" : rank > 0 ? "Member" : "Guest")
