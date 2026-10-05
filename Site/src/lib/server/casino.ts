import { randomBytes, randomInt } from "node:crypto"
import {
	crashMultiplierAt,
	crashPointFrom,
	crashTimeTo,
	MAX_BET,
	MIN_BET,
	minesMultiplier,
	minesTiles,
	type PlinkoRisk,
	plinkoRows,
	plinkoTables,
	type SlotSymbol,
	slotSymbols,
	slotsMultiplier,
	slotWeightTotal,
} from "$lib/casinoMath"
import { burn, getBalance, mint } from "$lib/server/economy"
import { db, Record } from "$lib/server/surreal"

// The casino's server side: every outcome is decided here with a
// cryptographic RNG, and the pages only animate it. Bets burn currency and
// wins mint it (the Economy service records both). Rounds that span several
// requests (mines, crash) are stored in casinoRound so the hidden parts
// (mine positions, crash point) never reach the browser before the end.

const UNIT = 1_000_000
type Fetch = typeof globalThis.fetch

export class CasinoError extends Error {}

/** A bet in whole currency units within the limits, or a CasinoError. */
export function parseBet(value: unknown) {
	const bet = Number(value)
	if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET)
		throw new CasinoError(`Bets are whole amounts from ${MIN_BET} to ${MAX_BET}`)
	return bet
}

/** Uniform in [0, 1) */
const random = () => randomBytes(6).readUIntBE(0, 6) / 2 ** 48

// one casino action at a time per player, so double clicks can't double spend
const locks = new Map<string, Promise<unknown>>()
export function withLock<T>(user: string, fn: () => Promise<T>) {
	const run = (locks.get(user) ?? Promise.resolve()).then(fn, fn)
	locks.set(user, run)
	// cleanup on both outcomes; this chain also handles the rejection, which
	// would otherwise be unhandled and crash the process
	const cleanup = () => locks.get(user) === run && locks.delete(user)
	run.then(cleanup, cleanup)
	return run
}

async function takeBet(f: Fetch, user: string, bet: number, game: string) {
	const result = await burn(f, user, bet * UNIT, `Casino: ${game} bet`, `/casino/${game}`, {})
	if (!result.ok)
		throw new CasinoError(
			/insufficient/i.test(result.msg) ? "You don't have enough currency for this bet" : "Couldn't place the bet"
		)
}

/** Pays out `micro` units; retried, since the bet is already taken. */
async function pay(f: Fetch, user: string, micro: number, game: string) {
	if (micro <= 0) return
	for (let attempt = 1; ; attempt++) {
		const result = await mint(f, user, micro, `Casino: ${game} win`)
		if (result.ok) return
		console.error(`Casino payout of ${micro} to ${user} failed (attempt ${attempt}): ${result.msg}`)
		if (attempt === 3) throw new CasinoError("The payout failed, please contact staff")
		await Bun.sleep(500 * attempt)
	}
}

const payoutOf = (bet: number, multiplier: number) => Math.floor(bet * multiplier * UNIT)

export async function balance(f: Fetch, user: string) {
	const result = await getBalance(f, user)
	return result.ok ? Number(result.value) : null
}

// --- Slots ---

function slotSymbol(): SlotSymbol {
	let roll = randomInt(slotWeightTotal)
	for (const symbol of slotSymbols) {
		if (roll < symbol.weight) return symbol.id
		roll -= symbol.weight
	}
	return "cherry"
}

export const spinSlots = (f: Fetch, user: string, bet: number) =>
	withLock(user, async () => {
		await takeBet(f, user, bet, "slots")
		// reels[reel][row]; the middle row is the payline
		const reels = [0, 1, 2].map(() => [slotSymbol(), slotSymbol(), slotSymbol()])
		const multiplier = slotsMultiplier(reels.map(r => r[1]))
		const payout = payoutOf(bet, multiplier)
		await pay(f, user, payout, "slots")
		return { reels, multiplier, payout, balance: await balance(f, user) }
	})

// --- Horse plinko ---

export const dropPlinko = (f: Fetch, user: string, bet: number, risk: PlinkoRisk) =>
	withLock(user, async () => {
		await takeBet(f, user, bet, "plinko")
		const path = Array.from({ length: plinkoRows }, () => randomInt(2)) // 1 = right
		const slot = path.reduce((sum, step) => sum + step, 0)
		const multiplier = plinkoTables[risk][slot]
		const payout = payoutOf(bet, multiplier)
		await pay(f, user, payout, "plinko")
		return { path, slot, multiplier, payout, balance: await balance(f, user) }
	})

// --- Rounds (mines, crash) ---

type Round<D> = { id: string; bet: number; status: string; data: D; payout: number }

async function activeRound<D>(user: string, game: string) {
	const [[round]] = await db.query<[Round<D>[]]>(
		`SELECT record::id(id) AS id, bet, status, data, payout, created FROM casinoRound
		WHERE user = $user AND game = $game AND status = "active"
		ORDER BY created DESC LIMIT 1`,
		{ user: Record("user", user), game }
	)
	return round
}

async function createRound(user: string, game: string, bet: number, data: object) {
	const [id] = await db.query<[string]>(
		`RETURN (CREATE ONLY type::record("casinoRound", rand::id()) CONTENT {
			user: $user, game: $game, bet: $bet, status: "active", data: $data,
		} RETURN VALUE record::id(id));`,
		{ user: Record("user", user), game, bet, data }
	)
	return id
}

async function endRound(id: string, status: "won" | "lost", payout: number, data: object) {
	await db.query('UPDATE type::record("casinoRound", $id) MERGE { status: $status, payout: $payout, data: $data }', {
		id,
		status,
		payout,
		data,
	})
}

// --- Mines ---

type MinesData = { mines: number[]; mineCount: number; revealed: number[] }

const minesView = (round: Round<MinesData>, over = false) => ({
	bet: round.bet,
	mineCount: round.data.mineCount,
	revealed: round.data.revealed,
	multiplier: minesMultiplier(round.data.mineCount, round.data.revealed.length),
	next: minesMultiplier(round.data.mineCount, round.data.revealed.length + 1),
	...(over ? { mines: round.data.mines } : {}), // only once the round is over
})

export async function minesState(user: string) {
	const round = await activeRound<MinesData>(user, "mines")
	return round ? minesView(round) : null
}

export const startMines = (f: Fetch, user: string, bet: number, mineCount: number) =>
	withLock(user, async () => {
		if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > minesTiles - 1)
			throw new CasinoError("Choose 1 to 24 mines")
		if (await activeRound(user, "mines")) throw new CasinoError("Finish your current game first")

		await takeBet(f, user, bet, "mines")
		const tiles = Array.from({ length: minesTiles }, (_, i) => i)
		for (let i = tiles.length - 1; i > 0; i--) {
			const j = randomInt(i + 1)
			;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
		}
		const data: MinesData = { mines: tiles.slice(0, mineCount).sort((a, b) => a - b), mineCount, revealed: [] }
		const id = await createRound(user, "mines", bet, data)
		return { ...minesView({ id, bet, status: "active", data, payout: 0 }), balance: await balance(f, user) }
	})

async function cashOutMines(f: Fetch, user: string, round: Round<MinesData>) {
	const multiplier = minesMultiplier(round.data.mineCount, round.data.revealed.length)
	const payout = payoutOf(round.bet, multiplier)
	await endRound(round.id, "won", payout, round.data)
	await pay(f, user, payout, "mines")
	return { ...minesView(round, true), status: "won", payout, balance: await balance(f, user) }
}

export const revealMine = (f: Fetch, user: string, tile: number) =>
	withLock(user, async () => {
		const round = await activeRound<MinesData>(user, "mines")
		if (!round) throw new CasinoError("Start a game first")
		if (!Number.isInteger(tile) || tile < 0 || tile >= minesTiles) throw new CasinoError("Invalid tile")
		if (round.data.revealed.includes(tile)) return { ...minesView(round), status: "active" }

		if (round.data.mines.includes(tile)) {
			await endRound(round.id, "lost", 0, round.data)
			return { ...minesView(round, true), status: "lost", hit: tile, payout: 0, balance: await balance(f, user) }
		}
		round.data.revealed.push(tile)
		// every safe tile found: cash out automatically
		if (round.data.revealed.length === minesTiles - round.data.mineCount) return cashOutMines(f, user, round)
		await db.query('UPDATE type::record("casinoRound", $id) MERGE { data: $data }', {
			id: round.id,
			data: round.data,
		})
		return { ...minesView(round), status: "active" }
	})

export const cashOutMinesNow = (f: Fetch, user: string) =>
	withLock(user, async () => {
		const round = await activeRound<MinesData>(user, "mines")
		if (!round) throw new CasinoError("No game to cash out")
		if (!round.data.revealed.length) throw new CasinoError("Reveal at least one tile first")
		return cashOutMines(f, user, round)
	})

// --- Crash ---

type CrashData = { crashPoint: number; startedAt: number; autoCashOut?: number }

/** Settles a crash round if it's over (crashed, or auto cash out reached). */
async function settleCrash(f: Fetch, user: string, round: Round<CrashData>, now = Date.now()) {
	const elapsed = now - round.data.startedAt
	const { crashPoint, autoCashOut } = round.data
	if (autoCashOut && autoCashOut <= crashPoint && elapsed >= crashTimeTo(autoCashOut)) {
		const payout = payoutOf(round.bet, autoCashOut)
		await endRound(round.id, "won", payout, round.data)
		await pay(f, user, payout, "crash")
		return { status: "won", multiplier: autoCashOut, crashPoint, payout }
	}
	if (elapsed >= crashTimeTo(crashPoint)) {
		await endRound(round.id, "lost", 0, round.data)
		return { status: "lost", multiplier: crashPoint, crashPoint, payout: 0 }
	}
	return { status: "active", multiplier: crashMultiplierAt(elapsed), elapsed }
}

export const crashState = (f: Fetch, user: string) =>
	withLock(user, async () => {
		const round = await activeRound<CrashData>(user, "crash")
		if (!round) return null
		const state = await settleCrash(f, user, round)
		return { ...state, bet: round.bet, autoCashOut: round.data.autoCashOut, balance: await balance(f, user) }
	})

export const startCrash = (f: Fetch, user: string, bet: number, autoCashOut?: number) =>
	withLock(user, async () => {
		if (autoCashOut !== undefined && !(autoCashOut >= 1.01 && autoCashOut <= 10_000))
			throw new CasinoError("Auto cash out must be from 1.01x")
		const previous = await activeRound<CrashData>(user, "crash")
		if (previous && (await settleCrash(f, user, previous)).status === "active")
			throw new CasinoError("Your current round is still running")

		await takeBet(f, user, bet, "crash")
		const data: CrashData = {
			crashPoint: crashPointFrom(1 - random()),
			startedAt: Date.now(),
			...(autoCashOut ? { autoCashOut: Math.floor(autoCashOut * 100) / 100 } : {}),
		}
		await createRound(user, "crash", bet, data)
		return { status: "active", multiplier: 1, elapsed: 0, bet, autoCashOut: data.autoCashOut, balance: await balance(f, user) }
	})

export const cashOutCrash = (f: Fetch, user: string) =>
	withLock(user, async () => {
		const round = await activeRound<CrashData>(user, "crash")
		if (!round) throw new CasinoError("No round to cash out")
		const now = Date.now()
		const state = await settleCrash(f, user, round, now)
		if (state.status !== "active") return { ...state, bet: round.bet, balance: await balance(f, user) }

		const multiplier = crashMultiplierAt(now - round.data.startedAt)
		const payout = payoutOf(round.bet, multiplier)
		await endRound(round.id, "won", payout, round.data)
		await pay(f, user, payout, "crash")
		return {
			status: "won",
			multiplier,
			crashPoint: round.data.crashPoint,
			payout,
			bet: round.bet,
			balance: await balance(f, user),
		}
	})

/** Runs a casino action for the logged-in user as a JSON response. */
export async function casinoResponse(
	locals: App.Locals,
	action: (user: string) => Promise<unknown>
) {
	const json = (data: unknown, status = 200) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		})
	if (!locals.user) return json({ error: "Log in to play" }, 401)
	try {
		return json(await action(locals.user.id))
	} catch (e) {
		if (e instanceof CasinoError) return json({ error: e.message }, 400)
		console.error("Casino error:", e)
		return json({ error: "Something went wrong, please try again" }, 500)
	}
}
