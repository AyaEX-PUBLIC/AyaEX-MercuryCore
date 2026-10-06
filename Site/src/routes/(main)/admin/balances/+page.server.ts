import { error } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { economyConnFailed, getAllBalances } from "$lib/server/economy"
import { db } from "$lib/server/surreal"

type Row = BasicUser & { id: string; permissionLevel: number; created: string }

export async function load({ fetch: f, locals }) {
	await authorise(locals, 5)

	const [[users], balances] = await Promise.all([
		db.query<Row[][]>(
			"SELECT record::id(id) AS id, username, status, permissionLevel, created FROM user ORDER BY username"
		),
		getAllBalances(f),
	])
	if (!balances.ok) error(500, economyConnFailed)

	return {
		users: users
			.map(u => ({ ...u, balance: balances.value[u.id] ?? 0 }))
			.sort((a, b) => b.balance - a.balance),
	}
}
