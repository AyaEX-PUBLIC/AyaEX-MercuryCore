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
	<div class="page-head">
		<div>
			<div class="eyebrow">Play</div>
			<a href="/casino" class="light-text"><h1 class="casino-title">Casino</h1></a>
			<nav class="flex flex-wrap gap-1 pt-4" aria-label="Games">
				{#each games as [name, href, emoji]}
					<a
						{href}
						class="btn btn-sm game-link {page.url.pathname === href ? 'btn-secondary' : 'btn-quatenary'}">
						<span>{emoji}</span>
						{name}
					</a>
				{/each}
			</nav>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="btn btn-sm btn-tertiary"
				title={sound.on ? "Mute sounds" : "Turn sounds on"}
				aria-label={sound.on ? "Mute sounds" : "Turn sounds on"}
				onclick={toggleSound}>
				{sound.on ? "🔊" : "🔇"}
			</button>
			{#if balance !== null && balance !== undefined}
				<div class="wallet">
					<span class="eyebrow block">Balance</span>
					{page.data.currencySymbol}{money(balance)}
				</div>
			{/if}
		</div>
	</div>

	{@render children()}

	<p class="grey-text text-xs pt-10 text-center">
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
		padding: 0.25rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 1.125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--success);
		border: 1px solid var(--accent2);
	}
	@keyframes shimmer {
		to {
			background-position: -300% 0;
		}
	}
</style>
