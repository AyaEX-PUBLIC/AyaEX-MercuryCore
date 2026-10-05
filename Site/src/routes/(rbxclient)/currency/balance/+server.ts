import { error } from "@sveltejs/kit"
import { getBalance } from "$lib/server/economy"
import { json } from "$lib/server/engineParams"

// the purchase prompt shows the player's balance (from their session)
async function balance({ fetch: f, locals }: { fetch: typeof globalThis.fetch; locals: App.Locals }) {
	if (!locals.user) error(401, "Unauthorized")
	const result = await getBalance(f, locals.user.id)
	if (!result.ok) error(503, "Economy unavailable")
	const whole = Math.floor(Number(result.value) / 1_000_000)
	return json({ robux: whole, tickets: 0, Robux: whole, Tickets: 0 })
}
export const GET = balance
export const POST = balance
