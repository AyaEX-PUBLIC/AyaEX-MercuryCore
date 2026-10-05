import { casinoResponse, revealMine } from "$lib/server/casino"

export async function POST({ fetch: f, locals, request }) {
	const body = await request.json().catch(() => ({}))
	return casinoResponse(locals, user => revealMine(f, user, Number(body.tile)))
}
