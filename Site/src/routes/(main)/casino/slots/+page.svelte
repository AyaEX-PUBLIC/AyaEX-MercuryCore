<script lang="ts">
	import { tick } from "svelte"
	import Head from "$components/Head.svelte"
	import { oneCherry, type SlotSymbol, slotSymbols, twoCherries } from "$lib/casinoMath"
	import BetInput from "../BetInput.svelte"
	import { casinoApi, celebrate, money, reducedMotion, settle, sleep, spend } from "../casino.svelte"
	import { sfx } from "../sfx.svelte"

	const { data } = $props()

	type Result = { reels: SlotSymbol[][]; multiplier: number; payout: number; balance: number | null }

	const icons = Object.fromEntries(slotSymbols.map(s => [s.id, s.icon])) as Record<SlotSymbol, string>
	const ids = slotSymbols.map(s => s.id)
	const randomSymbol = () => ids[Math.floor(Math.random() * ids.length)]
	const randomColumn = () => [randomSymbol(), randomSymbol(), randomSymbol()]

	let bet = $state(10)
	let spinning = $state(false)
	let error = $state("")
	// each reel's strip of symbols; the visible window shows 3 of them
	let strips: SlotSymbol[][] = $state([randomColumn(), randomColumn(), randomColumn()])
	const stripEls: HTMLElement[] = []
	let stopped = $state([true, true, true])
	let anticipation = $state(false)
	let winCells = $state([false, false, false])
	let result: { payout: number; multiplier: number } | null = $state(null)
	let lost = $state(false)

	async function spinReel(i: number, final: SlotSymbol[], fillers: number, duration: number) {
		const el = stripEls[i]
		const cell = (el.firstElementChild as HTMLElement).offsetHeight
		strips[i] = [...strips[i], ...Array.from({ length: fillers }, randomSymbol), ...final]
		await tick()
		const distance = (strips[i].length - 3) * cell
		stopped[i] = false
		const animation = el.animate(
			[
				{ transform: "translateY(0)", filter: "blur(0)" },
				{ transform: `translateY(${-cell * 0.4}px)`, filter: "blur(0)", offset: 0.04 }, // wind up
				{ filter: "blur(3px)", offset: 0.15 },
				{ filter: "blur(3px)", offset: 0.75 },
				{ transform: `translateY(${-distance}px)`, filter: "blur(0)" },
			],
			{
				duration: reducedMotion() ? 300 : duration,
				// overshoots slightly, so the reel settles back into place
				easing: "cubic-bezier(0.25, 0.1, 0.25, 1.06)",
				fill: "forwards",
			}
		)
		await animation.finished
		strips[i] = final
		await tick()
		animation.cancel()
		stopped[i] = true
		sfx.reelStop()
	}

	async function spin() {
		if (spinning) return
		error = ""
		result = null
		lost = false
		winCells = [false, false, false]
		spinning = true
		sfx.click()
		let res: Result
		try {
			res = await casinoApi<Result>("slots", { bet })
		} catch (e) {
			error = (e as Error).message
			spinning = false
			return
		}
		spend(bet)

		const line = res.reels.map(r => r[1])
		// the last reel spins longer when the first two already match
		const tease = line[0] === line[1]
		const reels = [0, 1, 2].map(i =>
			spinReel(i, res.reels[i], 14 + i * 8 + (i === 2 && tease ? 16 : 0), 1000 + i * 450 + (i === 2 && tease ? 1500 : 0))
		)
		if (tease) {
			await reels[1]
			anticipation = true
		}
		await Promise.all(reels)
		anticipation = false

		if (res.multiplier > 0) {
			const three = line[0] === line[1] && line[1] === line[2]
			winCells = line.map(s => three || s === "cherry")
			result = { payout: res.payout, multiplier: res.multiplier }
			sfx.win()
			if (celebrate(res.payout, res.multiplier)) await sleep(400)
		} else {
			lost = true
			sfx.lose()
		}
		settle(res.balance)
		spinning = false
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
			e.preventDefault()
			spin()
		}
	}
</script>

<svelte:window {onkeydown} />

<Head name={data.siteName} title="Slots" />

<div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-6 items-start">
	<div class="cabinet" class:spinning class:won={!!result} class:anticipation>
		<div class="lights" aria-hidden="true">
			{#each { length: 18 } as _, i}
				<span style="--i: {i}"></span>
			{/each}
		</div>
		<div class="window">
			{#each strips as strip, i}
				<div class="reel" class:anticipate={anticipation && i === 2}>
					<div class="strip" bind:this={stripEls[i]}>
						{#each strip as symbol, j}
							<div class="cell" class:win={stopped[i] && j === 1 && winCells[i]} class:dim={!!result && stopped[i] && j !== 1}>
								<span class="symbol" class:bounce={stopped[i] && spinning}>{icons[symbol]}</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
			<div class="payline" aria-hidden="true"></div>
		</div>

		<div class="status" aria-live="polite">
			{#if result}
				{#key result}
					<span class="win-text" class:small-win={result.multiplier < 1}>
						{result.multiplier < 1 ? "BACK" : "WIN"}
						{data.currencySymbol}{money(result.payout)}
						<small>×{result.multiplier}</small>
					</span>
				{/key}
			{:else if lost}
				<span class="grey-text">No win this time</span>
			{:else if anticipation}
				<span class="tease">…</span>
			{:else}
				<span class="grey-text">Good luck!</span>
			{/if}
		</div>

		<div class="controls">
			<div class="grow min-w-0"><BetInput bind:bet disabled={spinning} /></div>
			<button type="button" class="spin" disabled={spinning} onclick={spin}>
				{spinning ? "…" : "SPIN"}
			</button>
		</div>
		{#if error}
			<p class="text-red-500 pt-2 text-center">{error}</p>
		{/if}
	</div>

	<div class="card bg-darker p-4">
		<h2 class="text-lg pb-2">Paytable</h2>
		<table class="w-full">
			<tbody>
				{#each slotSymbols as symbol}
					<tr>
						<td class="text-xl">{symbol.icon}{symbol.icon}{symbol.icon}</td>
						<td class="text-right font-bold">×{symbol.pays}</td>
					</tr>
				{/each}
				<tr>
					<td class="text-xl">🍒🍒</td>
					<td class="text-right font-bold">×{twoCherries}</td>
				</tr>
				<tr>
					<td class="text-xl">🍒</td>
					<td class="text-right font-bold">×{oneCherry}</td>
				</tr>
			</tbody>
		</table>
		<p class="grey-text text-sm pt-2">Pays on the middle line. Press space to spin.</p>
	</div>
</div>

<style>
	.cabinet {
		--cell: clamp(4.5rem, 22vw, 7rem);
		position: relative;
		padding: 2rem clamp(0.6rem, 3vw, 1.25rem) 1.25rem;
		border-radius: 1.5rem;
		background: linear-gradient(160deg, #3a0d4f, #1a0626 60%, #2b0a3d);
		box-shadow:
			inset 0 0 0 3px #ffd23f,
			inset 0 0 0 7px #8a5a12,
			0 20px 50px -20px #000;
	}
	.lights {
		position: absolute;
		top: 0.7rem;
		left: 1.5rem;
		right: 1.5rem;
		display: flex;
		justify-content: space-between;
	}
	.lights span {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: #ffd23f;
		box-shadow: 0 0 8px #ffd23f;
		animation: chase 1.8s calc(var(--i) * 0.1s) infinite;
	}
	.spinning .lights span {
		animation-duration: 0.6s;
	}
	.won .lights span {
		animation: flash 0.25s calc(var(--i) * 0.02s) infinite alternate;
	}
	.window {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: 1rem;
		background: #0c0312;
	}
	.reel {
		position: relative;
		height: calc(var(--cell) * 3);
		overflow: hidden;
		border-radius: 0.6rem;
		background: linear-gradient(180deg, #d9d4e6, #fff 30%, #fff 70%, #d9d4e6);
		transition: box-shadow 0.3s;
	}
	.reel::after {
		/* curved glass shading */
		content: "";
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(180deg, rgb(0 0 0 / 0.55), transparent 28%, transparent 72%, rgb(0 0 0 / 0.55));
	}
	.reel.anticipate {
		animation: tease 0.4s ease-in-out infinite alternate;
	}
	.cell {
		height: var(--cell);
		display: grid;
		place-items: center;
		font-size: calc(var(--cell) * 0.6);
		line-height: 1;
		transition: opacity 0.3s;
	}
	.cell.dim {
		opacity: 0.35;
	}
	.symbol.bounce {
		animation: land 0.35s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.cell.win .symbol {
		animation: winning 0.6s ease-in-out infinite alternate;
	}
	.payline {
		position: absolute;
		left: 0.25rem;
		right: 0.25rem;
		top: 50%;
		height: 3px;
		margin-top: -1.5px;
		background: rgb(255 60 90 / 0.65);
		pointer-events: none;
		transition: box-shadow 0.3s;
	}
	.won .payline {
		background: #ffd23f;
		box-shadow: 0 0 12px 3px #ffd23f;
		animation: flash 0.3s infinite alternate;
	}
	.status {
		min-height: 3.5rem;
		display: grid;
		place-items: center;
		font-size: 1.2rem;
	}
	.win-text {
		font-size: 1.9rem;
		font-weight: 900;
		color: #ffd23f;
		text-shadow: 0 0 14px #ff9f1c;
		animation: pop 0.5s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.win-text.small-win {
		font-size: 1.4rem;
		color: #e9d8a6;
		text-shadow: none;
	}
	.win-text small {
		font-size: 1rem;
		color: #fff;
	}
	.tease {
		font-size: 2rem;
		color: #ffd23f;
		animation: flash 0.3s infinite alternate;
	}
	.controls {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
	}
	.spin {
		width: clamp(4.25rem, 18vw, 5.5rem);
		height: clamp(4.25rem, 18vw, 5.5rem);
		flex-shrink: 0;
		border-radius: 50%;
		border: none;
		font-weight: 900;
		font-size: 1.2rem;
		color: #3b1d00;
		cursor: pointer;
		background: radial-gradient(circle at 35% 30%, #fff3b0, #ffc300 45%, #e07a00);
		box-shadow:
			0 6px 0 #8a5a12,
			0 10px 20px -6px #000;
		transition: transform 0.1s;
	}
	.spin:hover:not(:disabled) {
		filter: brightness(1.08);
	}
	.spin:active:not(:disabled) {
		transform: translateY(5px);
		box-shadow: 0 1px 0 #8a5a12;
	}
	.spin:disabled {
		cursor: default;
		filter: grayscale(0.6) brightness(0.8);
	}
	.cabinet :global(label .grey-text) {
		color: #c9b8d6;
	}
	@keyframes chase {
		0%,
		60%,
		100% {
			opacity: 0.25;
		}
		30% {
			opacity: 1;
		}
	}
	@keyframes flash {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes tease {
		from {
			box-shadow: 0 0 0 3px #ffd23f, 0 0 12px 2px #ff9f1c;
		}
		to {
			box-shadow: 0 0 0 3px #ff4d6d, 0 0 26px 8px #ff4d6d;
		}
	}
	@keyframes land {
		from {
			transform: translateY(-14%);
		}
	}
	@keyframes winning {
		from {
			transform: scale(1);
			filter: drop-shadow(0 0 0 #ffd23f);
		}
		to {
			transform: scale(1.18) rotate(-4deg);
			filter: drop-shadow(0 0 10px #ffd23f);
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.3);
			opacity: 0;
		}
	}
</style>
