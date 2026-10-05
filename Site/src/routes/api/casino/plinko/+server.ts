import { plinkoTables } from "$lib/casinoMath"
import { CasinoError, casinoResponse, dropPlinko, parseBet } from "$lib/server/casino"

export async function POST({ fetch: f, locals, request }) {
	const body = await request.json().catch(() => ({}))
	return casinoResponse(locals, user => {
		if (!(body.risk in plinkoTables)) throw new CasinoError("Choose low, medium or high risk")
		return dropPlinko(f, user, parseBet(body.bet), body.risk)
	})
}
