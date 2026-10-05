<script lang="ts">
	import { onMount } from "svelte"
	import { afterNavigate, invalidateAll } from "$app/navigation"
	import { page } from "$app/state"
	import BigWin from "./BigWin.svelte"
	import { money, wallet } from "./casino.svelte"
	import { loadSound, sound, toggleSound } from "./sfx.svelte"

	let { children } = $props()

	const games = [
		["Slots", "/casino/slots", "🎰"],
		["Mines", "/casino/mines", "💣"],
		["Crash", "/casino/crash", "🚀"],
		["Horse plinko", "/casino/plinko", "🐎"],
	]

	// the server's balance whenever the page data is refreshed (after each
	// result, see settle()), unless a bet is still being animated
	$effect(() => {
		const balance = page.data.balance
		if (!wallet.busy && balance !== null && balance !== undefined) wallet.balance = balance
	})
	onMount(loadSound)
	// results still animating on the page that was left won't settle
	afterNavigate(() => {
		if (!wallet.busy) return
		wallet.busy = 0
		invalidateAll()
	})

	const balance = $derived(wallet.balance ?? page.data.balance)
</script>

<div class="ctnr casino">
	<div class="flex flex-wrap items-center gap-2 pb-6">
		<a href="/casino" class="light-text no-underline text-2xl font-bold pr-4 casino-title">Casino</a>
		{#each games as [name, href, emoji]}
			<a
				{href}
				class="btn btn-sm no-underline game-link {page.url.pathname === href ? 'btn-primary' : 'btn-secondary'}">
				<span class="pr-1">{emoji}</span>
				{name}
			</a>
		{/each}
		<div class="grow"></div>
		<button
			type="button"
			class="btn btn-sm btn-secondary"
			title={sound.on ? "Mute sounds" : "Turn sounds on"}
			aria-label={sound.on ? "Mute sounds" : "Turn sounds on"}
			onclick={toggleSound}>
			{sound.on ? "🔊" : "🔇"}
		</button>
		{#if balance !== null && balance !== undefined}
			<div class="wallet font-bold text-emerald-500 text-lg">
				{page.data.currencySymbol}{money(balance)}
			</div>
		{/if}
	</div>

	{@render children()}

	<p class="grey-text text-xs pt-8 text-center">
		Every game returns about 93% of what's bet over time. Outcomes are decided by the server. Play for fun:
		{page.data.siteName} currency has no real-world value.
	</p>
</div>

<BigWin />

<style>
	.casino-title {
		background: linear-gradient(90deg, #ffd23f, #ff6ad5, #4dd4ff, #ffd23f);
		background-size: 300% 100%;
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
		animation: shimmer 6s linear infinite;
	}
	.wallet {
		font-variant-numeric: tabular-nums;
	}
	@keyframes shimmer {
		to {
			background-position: -300% 0;
		}
	}
</style>
