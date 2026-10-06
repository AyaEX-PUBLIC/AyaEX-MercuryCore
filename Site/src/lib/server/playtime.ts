import { mint } from "$lib/server/economy"
import { db, Record } from "$lib/server/surreal"

// Players earn currency for time spent in game: REWARD every INTERVAL of
// continuous play, counted from the gameserver's presence pings (every ~5s,
// /game/serverpresence). A gap of more than GAP restarts the timer, so
// rejoining doesn't skip ahead; one timer per account, however many servers.

const REWARD = 5 // currency units
const INTERVAL = "5m"
const GAP = "1m"

export async function rewardPlaytime(f: typeof globalThis.fetch, userIds: string[]) {
	const results = await db.query<unknown[]>(
		`-- back after a gap (or first time): start a new timer
		UPDATE $users SET playRewardAt = time::now() + ${INTERVAL}
			WHERE lastInGame == NONE OR lastInGame < time::now() - ${GAP} OR playRewardAt == NONE;
		-- pay whoever's timer ran out, moving it on (a conditional update, so two
		-- servers pinging at once can't both pay)
		LET $due = (UPDATE $users SET playRewardAt = playRewardAt + ${INTERVAL}
			WHERE playRewardAt <= time::now() RETURN VALUE record::id(id));
		UPDATE $users SET lastInGame = time::now();
		RETURN $due;`,
		{ users: userIds.map(id => Record("user", id)) }
	)
	const due = (results.at(-1) ?? []) as string[]

	for (const user of due) {
		const result = await mint(f, user, REWARD * 1_000_000, "Playtime reward")
		if (!result.ok) console.error(`Playtime reward for ${user} failed: ${result.msg}`)
	}
}
