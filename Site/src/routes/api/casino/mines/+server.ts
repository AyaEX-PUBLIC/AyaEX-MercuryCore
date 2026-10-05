import { casinoResponse, minesState, parseBet, startMines } from "$lib/server/casino"

// the running game, if any (without the mine positions)
export const GET = ({ locals }) => casinoResponse(locals, minesState)

export async function POST({ fetch: f, locals, request }) {
	const body = await request.json().catch(() => ({}))
	return casinoResponse(locals, user => startMines(f, user, parseBet(body.bet), Number(body.mines)))
}
