<script lang="ts">
	import Head from "$components/Head.svelte"

	const { data } = $props()

	const games = [
		{
			name: "Slots",
			href: "/casino/slots",
			emoji: "🎰",
			blurb: "Three reels, one line. Line up three 7️⃣ for 1000× your bet.",
			from: "#ff9f1c",
			to: "#e5383b",
		},
		{
			name: "Mines",
			href: "/casino/mines",
			emoji: "💎",
			blurb: "Find the gems, dodge the mines, and cash out before it blows.",
			from: "#2ec4b6",
			to: "#3a0ca3",
		},
		{
			name: "Crash",
			href: "/casino/crash",
			emoji: "🚀",
			blurb: "The multiplier climbs until the rocket explodes. Cash out in time.",
			from: "#4361ee",
			to: "#7209b7",
		},
		{
			name: "Horse plinko",
			href: "/casino/plinko",
			emoji: "🐎",
			blurb: "Drop a horse through the pegs and see where it gallops. Up to 150×.",
			from: "#06d6a0",
			to: "#118ab2",
		},
	]
</script>

<Head name={data.siteName} title="Casino" />

<div class="tiles grid sm:grid-cols-2">
	{#each games as game, i}
		<a
			href={game.href}
			class="game light-text"
			style="--from: {game.from}; --to: {game.to}; --i: {i}">
			<span class="emoji" aria-hidden="true">{game.emoji}</span>
			<span class="eyebrow">Game {i + 1}</span>
			<span class="text-2xl font-600 pt-2">{game.name}</span>
			<span class="grey-text text-sm pt-2 max-w-72">{game.blurb}</span>
			<span class="btn btn-sm btn-secondary self-start mt-auto">
				Play
				<fa fa-arrow-right></fa>
			</span>
		</a>
	{/each}
</div>

<style>
	.game {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 14rem;
		padding: 1.5rem;
		overflow: hidden;
		background: var(--background);
		transition: background-color 0.2s;
		animation: rise 0.4s calc(var(--i) * 60ms) ease-out backwards;
		&::before {
			content: "";
			position: absolute;
			inset: 0 auto 0 0;
			width: 3px;
			background: linear-gradient(var(--from), var(--to));
		}
		&:hover {
			background: var(--accent);
			& .emoji {
				transform: rotate(-10deg) scale(1.1);
			}
		}
	}
	.emoji {
		position: absolute;
		right: 1.25rem;
		bottom: 1rem;
		font-size: 5.5rem;
		line-height: 1;
		transition: transform 0.3s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 0.75rem;
		}
	}
</style>
