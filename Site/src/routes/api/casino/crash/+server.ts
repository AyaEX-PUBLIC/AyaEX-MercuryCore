import { casinoResponse, crashState, parseBet, startCrash } from "$lib/server/casino"

// the running round's state; the crash point is only revealed once it's over
export const GET = ({ fetch: f, locals }) => casinoResponse(locals, user => crashState(f, user))

export async function POST({ fetch: f, locals, request }) {
	const body = await request.json().catch(() => ({}))
	const auto = body.autoCashOut ? Number(body.autoCashOut) : undefined
	return casinoResponse(locals, user => startCrash(f, user, parseBet(body.bet), auto))
}
