<script lang="ts">
	import { MAX_BET, MIN_BET } from "$lib/casinoMath"
	import { wallet } from "./casino.svelte"

	let { bet = $bindable(), disabled = false }: { bet: number; disabled?: boolean } = $props()

	const clamp = (value: number) => Math.min(Math.max(Math.floor(value) || MIN_BET, MIN_BET), MAX_BET)
	const max = () => clamp(Math.min(MAX_BET, Math.floor((wallet.balance ?? 0) / 1e6)))
</script>

<label class="flex flex-col gap-1">
	<span class="text-sm grey-text">Bet</span>
	<div class="flex gap-1">
		<input
			type="number"
			min={MIN_BET}
			max={MAX_BET}
			step="1"
			bind:value={bet}
			onchange={() => (bet = clamp(bet))}
			{disabled}
			class="w-full min-w-0" />
		<button type="button" class="btn btn-sm btn-secondary" {disabled} onclick={() => (bet = clamp(bet / 2))}>½</button>
		<button type="button" class="btn btn-sm btn-secondary" {disabled} onclick={() => (bet = clamp(bet * 2))}>2×</button>
		<button type="button" class="btn btn-sm btn-secondary" {disabled} onclick={() => (bet = max())}>Max</button>
	</div>
</label>
