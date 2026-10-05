// Casino rules shared by the server (which decides every outcome, see
// lib/server/casino.ts) and the pages (paytables, multipliers). Every game
// returns about RTP of what is bet over time.

export const RTP = 0.93
export const MIN_BET = 1
export const MAX_BET = 10_000

/** Big win tiers by multiplier, for the celebrations. */
export function winTier(multiplier: number) {
	if (multiplier >= 200) return "jackpot"
	if (multiplier >= 50) return "mega"
	if (multiplier >= 10) return "big"
	return undefined
}

// --- Slots: 3 reels, paid on the middle line ---

export const slotSymbols = [
	{ id: "seven", icon: "7️⃣", weight: 1, pays: 1000 },
	{ id: "diamond", icon: "💎", weight: 2, pays: 150 },
	{ id: "star", icon: "⭐", weight: 3, pays: 40 },
	{ id: "grape", icon: "🍇", weight: 5, pays: 20 },
	{ id: "bell", icon: "🔔", weight: 6, pays: 13 },
	{ id: "lemon", icon: "🍋", weight: 7, pays: 8 },
	{ id: "cherry", icon: "🍒", weight: 8, pays: 6 },
] as const
export type SlotSymbol = (typeof slotSymbols)[number]["id"]
export const slotWeightTotal = slotSymbols.reduce((sum, s) => sum + s.weight, 0)
export const twoCherries = 2
export const oneCherry = 0.5

export function slotsMultiplier(line: SlotSymbol[]) {
	if (line[0] === line[1] && line[1] === line[2])
		return slotSymbols.find(s => s.id === line[0])?.pays ?? 0
	const cherries = line.filter(s => s === "cherry").length
	return cherries === 2 ? twoCherries : cherries === 1 ? oneCherry : 0
}

// --- Horse plinko: 12 rows, the horse goes left or right at each peg ---

export const plinkoRows = 12
const mirror = (half: number[]) => [...half, ...half.slice(0, -1).reverse()]
export const plinkoTables = {
	low: mirror([9, 3, 1.5, 1.2, 1.1, 0.9, 0.52]),
	medium: mirror([30, 10, 3.6, 2, 1, 0.55, 0.32]),
	high: mirror([150, 22, 8, 2, 0.55, 0.2, 0.2]),
}
export type PlinkoRisk = keyof typeof plinkoTables

// --- Mines: 25 tiles; cash out after revealing safe tiles ---

export const minesTiles = 25

/** Payout multiplier after `revealed` safe tiles with `mines` mines (RTP of fair odds, rounded down). */
export function minesMultiplier(mines: number, revealed: number) {
	let fair = 1
	for (let i = 0; i < revealed; i++) fair *= (minesTiles - i) / (minesTiles - mines - i)
	return Math.floor(RTP * fair * 100) / 100
}

// --- Crash: the multiplier grows until the crash point ---

/** Multiplier growth per millisecond: 2x after ~7s, 10x after ~23s. */
export const crashRate = 0.0001
export const crashMax = 10_000

export const crashMultiplierAt = (ms: number) =>
	Math.floor(Math.exp(crashRate * Math.max(ms, 0)) * 100) / 100

/** Milliseconds until the multiplier reaches `multiplier`. */
export const crashTimeTo = (multiplier: number) => Math.log(multiplier) / crashRate

/**
 * Crash point from a uniform u in (0, 1]: P(point >= m) = RTP / m, so cashing
 * out at any target returns RTP on average (below 1 means an instant crash).
 */
export function crashPointFrom(u: number) {
	const point = Math.floor((RTP / u) * 100) / 100
	return Math.min(Math.max(point, 1), crashMax)
}
