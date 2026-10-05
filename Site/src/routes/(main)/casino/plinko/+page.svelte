<script lang="ts">
	import Head from "$components/Head.svelte"
	import { type PlinkoRisk, plinkoRows, plinkoTables } from "$lib/casinoMath"
	import BetInput from "../BetInput.svelte"
	import { casinoApi, celebrate, money, reducedMotion, settle, spend } from "../casino.svelte"
	import { sfx } from "../sfx.svelte"

	const { data } = $props()

	type Result = { path: number[]; slot: number; multiplier: number; payout: number; balance: number | null }
	type Horse = { id: number; x: number; y: number; dir: number; tilt: number }

	let bet = $state(10)
	let risk: PlinkoRisk = $state("medium")
	let error = $state("")
	let horses: Horse[] = $state([])
	let recent: { id: number; multiplier: number; slot: number }[] = $state([])
	let floats: { id: number; slot: number; text: string; good: boolean }[] = $state([])
	let landing = $state<number[]>([]) // bucket bounce counters
	let sending = $state(false)

	const table = $derived(plinkoTables[risk])
	const risks: PlinkoRisk[] = ["low", "medium", "high"]

	// board geometry (SVG units)
	const gap = 40
	const rowH = 30
	const top = 56
	const width = (plinkoRows + 3) * gap
	const cx = width / 2
	const bucketY = top + plinkoRows * rowH + 6
	const height = bucketY + 44
	const pegs = Array.from({ length: plinkoRows }, (_, r) =>
		Array.from({ length: r + 3 }, (_, j) => ({ x: cx + (j - (r + 2) / 2) * gap, y: top + r * rowH }))
	)
	const bucketX = (slot: number) => cx + (slot - plinkoRows / 2) * gap

	function bucketColour(multiplier: number) {
		if (multiplier >= 20) return ["#ff2e63", "#ff9fb7"]
		if (multiplier >= 5) return ["#ff6b35", "#ffc29e"]
		if (multiplier >= 1.5) return ["#ffb627", "#ffe3a3"]
		if (multiplier >= 1) return ["#e9d758", "#fff6b8"]
		return ["#3d5a80", "#a9c3e0"]
	}

	const pegEls: SVGCircleElement[][] = pegs.map(() => [])
	function hitPeg(r: number, j: number) {
		const el = pegEls[r]?.[j]
		if (!el) return
		el.classList.remove("hit")
		void el.getBoundingClientRect()
		el.classList.add("hit")
	}

	let nextId = 0
	const ease = (t: number) => t * t

	function gallop(res: Result) {
		const id = nextId++
		const hop = 16
		const points: [number, number][] = [[cx, top - 50]]
		let k = 0
		for (let r = 0; r < plinkoRows; r++) {
			points.push([cx + (k - r / 2) * gap, top + r * rowH - 14])
			k += res.path[r]
		}
		points.push([bucketX(res.slot), bucketY + 6])
		const horse: Horse = { id, x: cx, y: top - 50, dir: 1, tilt: 0 }
		horses.push(horse)

		const segment = reducedMotion() ? 60 : 150
		const total = segment * (points.length - 1)
		const start = performance.now()
		let reached = 0
		return new Promise<void>(resolve => {
			const step = (now: number) => {
				const elapsed = Math.max(now - start, 0) // frame times can precede `start`
				const i = Math.min(Math.floor(elapsed / segment), points.length - 2)
				const t = Math.min((elapsed - i * segment) / segment, 1)
				const [x0, y0] = points[i]
				const [x1, y1] = points[i + 1]
				const h = horses.find(h => h.id === id)
				if (h) {
					h.x = x0 + (x1 - x0) * t
					// the first drop falls straight in; later hops arc off each peg
					h.y = i === 0 ? y0 + (y1 - y0) * ease(t) : y0 + (y1 - y0) * t - hop * 4 * t * (1 - t)
					if (x1 !== x0) h.dir = x1 > x0 ? -1 : 1 // the emoji faces left
					h.tilt = (x1 - x0) * 0.25 * (1 - t)
				}
				// landing on each peg row in turn
				const arrived = Math.min(Math.floor(elapsed / segment), plinkoRows)
				while (reached < arrived) {
					const r = reached++
					const right = res.path.slice(0, r).reduce((a, b) => a + b, 0)
					hitPeg(r, right + 1)
					sfx.tick(0.9 + r * 0.06)
				}
				if (elapsed < total) requestAnimationFrame(step)
				else {
					horses = horses.filter(h => h.id !== id)
					resolve()
				}
			}
			requestAnimationFrame(step)
		})
	}

	async function drop() {
		if (sending) return
		error = ""
		sending = true
		let res: Result
		try {
			res = await casinoApi<Result>("plinko", { bet, risk })
		} catch (e) {
			error = (e as Error).message
			sending = false
			return
		}
		sending = false
		spend(bet)
		sfx.click()
		await gallop(res)

		landing[res.slot] = (landing[res.slot] ?? 0) + 1
		const fid = nextId++
		floats.push({ id: fid, slot: res.slot, text: `${res.multiplier}×`, good: res.multiplier >= 1 })
		setTimeout(() => (floats = floats.filter(f => f.id !== fid)), 1200)
		recent = [{ id: fid, multiplier: res.multiplier, slot: res.slot }, ...recent].slice(0, 10)
		if (res.multiplier >= 1) sfx.win()
		else sfx.lose()
		celebrate(res.payout, res.multiplier)
		settle(res.balance, res.payout)
	}
</script>

<Head name={data.siteName} title="Horse plinko" />

<div class="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-6 items-start">
	<div class="card bg-darker p-4 flex flex-col gap-4">
		<BetInput bind:bet />
		<div class="flex flex-col gap-1">
			<span class="text-sm grey-text">Risk</span>
			<div class="flex gap-1">
				{#each risks as level}
					<button
						type="button"
						class="btn btn-sm grow capitalize {risk === level ? 'btn-primary' : 'btn-secondary'}"
						disabled={horses.length > 0}
						onclick={() => (risk = level)}>
						{level}
					</button>
				{/each}
			</div>
		</div>
		<button type="button" class="btn btn-primary drop" disabled={sending} onclick={drop}>
			🐎 Drop a horse
		</button>
		<p class="grey-text text-xs">Drop several at once. The risk can be changed once every horse has landed.</p>
		{#if error}
			<p class="text-red-500 text-sm">{error}</p>
		{/if}
		{#if recent.length}
			<div class="flex flex-wrap gap-1">
				{#each recent as r (r.id)}
					{@const [bg] = bucketColour(r.multiplier)}
					<span class="chip" style="--bg: {bg}">{r.multiplier}×</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="board">
		<svg viewBox="0 0 {width} {height}" role="img" aria-label="Plinko board">
			<defs>
				<radialGradient id="peg" cx="35%" cy="35%">
					<stop offset="0%" stop-color="#fff" />
					<stop offset="100%" stop-color="#9fb3d1" />
				</radialGradient>
			</defs>
			{#each pegs as row, r}
				{#each row as peg, j}
					<circle bind:this={pegEls[r][j]} class="peg" cx={peg.x} cy={peg.y} r="5" fill="url(#peg)" />
				{/each}
			{/each}

			{#each table as multiplier, slot}
				{@const [bg, fg] = bucketColour(multiplier)}
				{#key landing[slot]}
					<g class="bucket" class:landed={landing[slot]} style="--bg: {bg}">
						<rect x={bucketX(slot) - gap / 2 + 2} y={bucketY} width={gap - 4} height="30" rx="6" fill={bg} />
						<text x={bucketX(slot)} y={bucketY + 19.5} text-anchor="middle" fill={fg} class="bucket-text">
							{multiplier}×
						</text>
					</g>
				{/key}
			{/each}

			{#each floats as f (f.id)}
				<text class="float" class:good={f.good} x={bucketX(f.slot)} y={bucketY - 8} text-anchor="middle">{f.text}</text>
			{/each}

			{#each horses as horse (horse.id)}
				<g transform="translate({horse.x} {horse.y}) rotate({horse.tilt})">
					<text class="horse" transform="scale({horse.dir} 1)" text-anchor="middle" dominant-baseline="central">🐎</text>
				</g>
			{/each}
		</svg>
	</div>
</div>

<style>
	.board {
		border-radius: 1rem;
		padding: 0.5rem;
		background: radial-gradient(ellipse at 50% 0%, #1d4d3a, #0b1f18 70%);
		box-shadow: inset 0 0 0 2px #1f5c45;
	}
	svg {
		width: 100%;
		max-height: calc(100vh - 13rem);
		height: auto;
		display: block;
		overflow: visible;
	}
	.peg {
		transform-box: fill-box;
		transform-origin: center;
	}
	.peg:global(.hit) {
		animation: peg 0.35s ease-out;
	}
	.bucket {
		transform-box: fill-box;
		transform-origin: center top;
	}
	.bucket.landed {
		animation: bucket 0.5s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.bucket-text {
		font-size: 11px;
		font-weight: 800;
	}
	.horse {
		font-size: 28px;
		filter: drop-shadow(0 3px 2px rgb(0 0 0 / 0.5));
	}
	.float {
		font-size: 18px;
		font-weight: 900;
		fill: #a9c3e0;
		animation: float 1.2s ease-out forwards;
		paint-order: stroke;
		stroke: #000;
		stroke-width: 3px;
	}
	.float.good {
		fill: #ffd23f;
	}
	.drop:not(:disabled):active {
		transform: scale(0.96);
	}
	.chip {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		color: #111;
		background: var(--bg);
		animation: chip 0.4s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	@keyframes peg {
		0% {
			transform: scale(1.9);
			fill: #ffd23f;
			filter: drop-shadow(0 0 6px #ffd23f);
		}
	}
	@keyframes bucket {
		30% {
			transform: translateY(8px);
			filter: brightness(1.6) drop-shadow(0 0 10px var(--bg));
		}
	}
	@keyframes float {
		from {
			transform: translateY(0);
			opacity: 1;
		}
		to {
			transform: translateY(-60px);
			opacity: 0;
		}
	}
	@keyframes chip {
		from {
			transform: scale(0);
		}
	}
</style>
