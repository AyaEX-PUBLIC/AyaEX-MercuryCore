<script lang="ts">
	import { onMount } from "svelte"
	import Head from "$components/Head.svelte"
	import { minesMultiplier, minesTiles } from "$lib/casinoMath"
	import BetInput from "../BetInput.svelte"
	import { casinoApi, celebrate, money, settle, spend } from "../casino.svelte"
	import { sfx } from "../sfx.svelte"

	const { data } = $props()

	type State = {
		bet: number
		mineCount: number
		revealed: number[]
		multiplier: number
		next: number
		mines?: number[]
		status?: "active" | "won" | "lost"
		hit?: number
		payout?: number
		balance?: number | null
	}

	let bet = $state(10)
	let mineCount = $state(3)
	let round: State | null = $state(null)
	let busy = $state(false)
	let pending = $state(-1)
	let error = $state("")
	let shaking = $state(false)
	let flash: "win" | "lose" | null = $state(null)

	const active = $derived(round?.status === "active")
	const over = $derived(round?.status === "won" || round?.status === "lost")
	const revealedCount = $derived(round?.revealed.length ?? 0)

	onMount(async () => {
		try {
			const state = await casinoApi<State | null>("mines")
			if (state) round = { ...state, status: "active" }
		} catch {}
	})

	// order in which the hidden tiles are uncovered when the round ends
	const revealOrder = $derived.by(() => {
		const order = new Map<number, number>()
		if (!round?.mines) return order
		const hidden = Array.from({ length: minesTiles }, (_, i) => i).filter(i => !round?.revealed.includes(i))
		const from = round.hit ?? 12
		const distance = (i: number) => Math.hypot((i % 5) - (from % 5), Math.floor(i / 5) - Math.floor(from / 5))
		hidden.sort((a, b) => distance(a) - distance(b)).forEach((tile, n) => order.set(tile, n))
		return order
	})

	function tileState(i: number) {
		if (!round) return "covered"
		if (round.revealed.includes(i)) return "gem"
		if (round.mines) {
			if (i === round.hit) return "boom"
			return round.mines.includes(i) ? "mine" : "gem-dim"
		}
		return "covered"
	}

	async function start() {
		if (busy || active) return
		error = ""
		flash = null
		busy = true
		try {
			round = { ...(await casinoApi<State>("mines", { bet, mines: mineCount })), status: "active" }
			spend(bet)
			sfx.click()
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	async function reveal(tile: number) {
		if (!active || busy || round?.revealed.includes(tile)) return
		busy = true
		pending = tile
		error = ""
		try {
			const res = await casinoApi<State>("mines/reveal", { tile })
			pending = -1
			round = res
			if (res.status === "lost") {
				sfx.boom()
				shaking = true
				flash = "lose"
				setTimeout(() => (shaking = false), 600)
				settle(res.balance)
			} else {
				sfx.gem(res.revealed.length - 1)
				if (res.status === "won") finish(res)
			}
		} catch (e) {
			error = (e as Error).message
		}
		pending = -1
		busy = false
	}

	async function cashOut() {
		if (!active || busy || !revealedCount) return
		busy = true
		error = ""
		try {
			finish(await casinoApi<State>("mines/cashout", {}))
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	function finish(res: State) {
		round = res
		flash = "win"
		sfx.cashOut()
		celebrate(res.payout ?? 0, res.multiplier)
		settle(res.balance)
	}
</script>

<Head name={data.siteName} title="Mines" />

<div class="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-6 items-start">
	<div class="card bg-darker p-4 flex flex-col gap-4">
		<BetInput bind:bet disabled={active || busy} />
		<label class="flex flex-col gap-1">
			<span class="text-sm grey-text">Mines: <b class="light-text">{mineCount}</b></span>
			<input type="range" min="1" max="24" bind:value={mineCount} disabled={active || busy} />
			<span class="text-xs grey-text">First gem pays ×{minesMultiplier(mineCount, 1)}</span>
		</label>

		{#if active && round}
			<div class="stats">
				<div>
					<span class="grey-text text-sm">Multiplier</span>
					{#key round.multiplier}
						<b class="bump">×{round.multiplier || 1}</b>
					{/key}
				</div>
				<div>
					<span class="grey-text text-sm">Next gem</span>
					<b>×{round.next}</b>
				</div>
			</div>
			<button
				type="button"
				class="btn btn-primary cashout"
				class:ready={revealedCount > 0}
				disabled={busy || !revealedCount}
				onclick={cashOut}>
				{#if revealedCount}
					Cash out {data.currencySymbol}{money(Math.floor(round.bet * round.multiplier * 1e6))}
				{:else}
					Pick a tile
				{/if}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" disabled={busy} onclick={start}>
				{over ? "Play again" : "Start"}
			</button>
		{/if}

		{#if error}
			<p class="text-red-500 text-sm">{error}</p>
		{/if}
	</div>

	<div class="board-wrap">
		<div class="board" class:shaking class:locked={!active}>
			{#each { length: minesTiles } as _, i}
				{@const state = tileState(i)}
				<button
					type="button"
					class="tile {state}"
					class:pending={pending === i}
					class:flipped={state !== "covered"}
					style="--delay: {state === 'gem' || state === 'boom' ? 0 : (revealOrder.get(i) ?? 0) * 35}ms"
					aria-label={state === "covered" ? `Tile ${i + 1}` : state.startsWith("gem") ? "Gem" : "Mine"}
					disabled={!active || state !== "covered"}
					onclick={() => reveal(i)}>
					<span class="inner">
						<span class="face front"></span>
						<span class="face back">{state.startsWith("gem") ? "💎" : state === "covered" ? "" : "💣"}</span>
					</span>
					{#if state === "boom"}
						<span class="burst" aria-hidden="true"></span>
						<span class="boom-emoji" aria-hidden="true">💥</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if over && round && flash}
			<div class="result {flash}" aria-live="polite">
				{#if flash === "win"}
					<b>×{round.multiplier}</b>
					<span>{data.currencySymbol}{money(round.payout ?? 0)}</span>
				{:else}
					<b>BOOM</b>
					<span>−{data.currencySymbol}{round.bet}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.stats div {
		display: flex;
		flex-direction: column;
	}
	.stats b {
		font-size: 1.5rem;
		display: inline-block;
	}
	.bump {
		color: #4ade80;
		animation: bump 0.4s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.cashout.ready {
		animation: glow 1s ease-in-out infinite alternate;
	}

	.board-wrap {
		position: relative;
		max-width: 34rem;
		width: 100%;
		margin: 0 auto;
	}
	.board {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: clamp(0.35rem, 1.5vw, 0.7rem);
		padding: clamp(0.5rem, 2vw, 1rem);
		border-radius: 1rem;
		background: linear-gradient(160deg, #10233a, #0a1424);
		box-shadow: inset 0 0 0 2px #1f3b5c;
	}
	.board.shaking {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}
	.tile {
		position: relative;
		aspect-ratio: 1;
		border: none;
		padding: 0;
		background: none;
		perspective: 600px;
		cursor: pointer;
	}
	.tile:disabled {
		cursor: default;
	}
	.inner {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
		transition: transform 0.45s cubic-bezier(0.3, 1.5, 0.5, 1) var(--delay);
	}
	.flipped .inner {
		transform: rotateY(180deg);
	}
	.face {
		position: absolute;
		inset: 0;
		border-radius: 0.7rem;
		backface-visibility: hidden;
		display: grid;
		place-items: center;
		font-size: clamp(1.4rem, 6vw, 2.6rem);
	}
	.front {
		background: linear-gradient(160deg, #3b5f86, #23415f);
		box-shadow:
			inset 0 -5px 0 #16304a,
			inset 0 2px 0 rgb(255 255 255 / 0.15);
		transition:
			transform 0.15s,
			filter 0.15s;
	}
	.board:not(.locked) .tile:not(:disabled):hover .front {
		transform: translateY(-3px);
		filter: brightness(1.25);
	}
	.pending .front {
		animation: wobble 0.3s ease-in-out infinite;
	}
	.back {
		transform: rotateY(180deg);
		background: linear-gradient(160deg, #0f2e1f, #071a11);
		box-shadow: inset 0 0 0 2px #22c55e66;
	}
	.gem .back {
		animation: gem-pop 0.5s 0.15s cubic-bezier(0.2, 1.8, 0.4, 1) backwards;
		box-shadow:
			inset 0 0 0 2px #22c55e,
			0 0 18px #22c55e88;
	}
	.mine .back,
	.boom .back {
		background: linear-gradient(160deg, #3d0f17, #1d060a);
		box-shadow: inset 0 0 0 2px #ef444466;
	}
	.boom .back {
		background: radial-gradient(circle, #ff8a00, #b91c1c 60%, #3d0f17);
		box-shadow: 0 0 30px #ff4d00;
	}
	.gem-dim .back,
	.mine .back {
		opacity: 0.45;
	}
	.burst {
		position: absolute;
		inset: -40%;
		border-radius: 50%;
		pointer-events: none;
		background: radial-gradient(circle, #fff 0%, #ffd23f 20%, #ff4d00 45%, transparent 70%);
		animation: burst 0.6s ease-out forwards;
		z-index: 2;
	}
	.boom-emoji {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: clamp(2.5rem, 10vw, 4.5rem);
		pointer-events: none;
		z-index: 3;
		animation: boom 0.8s cubic-bezier(0.2, 1.6, 0.4, 1) forwards;
	}
	.result {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		padding: 1rem 2rem;
		border-radius: 1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		pointer-events: none;
		animation: result 0.5s 0.3s cubic-bezier(0.2, 1.6, 0.4, 1) backwards;
		backdrop-filter: blur(3px);
	}
	.result b {
		font-size: 2.5rem;
		line-height: 1.1;
	}
	.result.win {
		background: rgb(6 40 20 / 0.85);
		color: #4ade80;
		box-shadow:
			0 0 0 3px #22c55e,
			0 0 40px #22c55e88;
	}
	.result.lose {
		background: rgb(50 6 10 / 0.85);
		color: #f87171;
		box-shadow:
			0 0 0 3px #ef4444,
			0 0 40px #ef444488;
	}
	@keyframes gem-pop {
		from {
			font-size: 0;
		}
	}
	@keyframes wobble {
		50% {
			transform: scale(0.94) rotate(-3deg);
		}
	}
	@keyframes burst {
		from {
			transform: scale(0.2);
			opacity: 1;
		}
		to {
			transform: scale(1.6);
			opacity: 0;
		}
	}
	@keyframes boom {
		0% {
			transform: scale(0.2);
		}
		40% {
			transform: scale(1.6);
		}
		100% {
			transform: scale(0);
			opacity: 0;
		}
	}
	@keyframes bump {
		from {
			transform: scale(1.6);
		}
	}
	@keyframes glow {
		to {
			box-shadow: 0 0 18px 2px #22c55e;
		}
	}
	@keyframes result {
		from {
			transform: translate(-50%, -50%) scale(0.3);
			opacity: 0;
		}
	}
	@keyframes shake {
		10%,
		90% {
			transform: translate(-2px, 1px);
		}
		20%,
		80% {
			transform: translate(5px, -3px);
		}
		30%,
		50%,
		70% {
			transform: translate(-9px, 4px);
		}
		40%,
		60% {
			transform: translate(9px, -4px);
		}
	}
</style>
