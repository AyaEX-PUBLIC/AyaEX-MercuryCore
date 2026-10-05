import { casinoResponse, parseBet, spinSlots } from "$lib/server/casino"

export async function POST({ fetch: f, locals, request }) {
	const body = await request.json().catch(() => ({}))
	return casinoResponse(locals, user => spinSlots(f, user, parseBet(body.bet)))
}
