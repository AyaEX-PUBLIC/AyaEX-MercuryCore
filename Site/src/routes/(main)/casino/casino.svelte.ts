import { invalidateAll } from "$app/navigation"
import { winTier } from "$lib/casinoMath"

/** Currency amounts are micro-units: 1.5 units = 1_500_000. */
export function money(micro: number) {
	return (micro / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })
}

/**
 * The balance shown in the casino (micro-units). Bets are taken from it as
 * soon as they're placed, and winnings are added once the animation reveals
 * them, so the number never gives the result away early.
 */
export const wallet = $state({ balance: null as number | null, busy: 0 })

/** A bet was accepted: show it leaving the balance. */
export function spend(bet: number) {
	if (wallet.balance !== null) wallet.balance -= bet * 1e6
	wallet.busy++
}

/** A result was revealed: show the server's balance (once nothing else is in play) and refresh the top bar. */
export function settle(balance: number | null | undefined, payout = 0) {
	wallet.busy = Math.max(wallet.busy - 1, 0)
	if (wallet.busy > 0) {
		if (wallet.balance !== null) wallet.balance += payout
		return
	}
	if (balance !== null && balance !== undefined) wallet.balance = balance
	invalidateAll()
}

type BigWin = { tier: "big" | "mega" | "jackpot"; amount: number; multiplier: number; id: number }

/** The current big win celebration (see BigWin.svelte). */
export const celebration = $state({ current: null as BigWin | null })

/** Celebrates a win if it's big enough; returns whether it did. */
export function celebrate(amount: number, multiplier: number) {
	const tier = winTier(multiplier)
	if (!tier) return false
	celebration.current = { tier, amount, multiplier, id: Date.now() }
	return true
}

export async function casinoApi<T>(path: string, body?: object): Promise<T> {
	const res = await fetch(`/api/casino/${path}`, {
		method: body ? "POST" : "GET",
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	}).catch(() => null)
	const data = await res?.json().catch(() => null)
	if (!res?.ok || data?.error) throw new Error(data?.error ?? "The casino is unavailable right now")
	return data as T
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const reducedMotion = () =>
	typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
