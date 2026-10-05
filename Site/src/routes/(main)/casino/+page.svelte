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

<div class="grid sm:grid-cols-2 gap-4">
	{#each games as game, i}
		<a
			href={game.href}
			class="game no-underline rounded-4 p-6 flex flex-col gap-2"
			style="--from: {game.from}; --to: {game.to}; --i: {i}">
			<span class="emoji" aria-hidden="true">{game.emoji}</span>
			<span class="text-2xl font-bold text-white">{game.name}</span>
			<span class="text-white/85">{game.blurb}</span>
			<span class="play self-start mt-2 px-4 py-1 rounded-full font-bold">Play</span>
		</a>
	{/each}
</div>

<style>
	.game {
		position: relative;
		overflow: hidden;
		min-height: 13rem;
		background: linear-gradient(135deg, var(--from), var(--to));
		box-shadow: 0 8px 24px -12px var(--to);
		transition:
			transform 0.25s cubic-bezier(0.2, 1.4, 0.4, 1),
			box-shadow 0.25s;
		animation: rise 0.5s calc(var(--i) * 80ms) cubic-bezier(0.2, 1.3, 0.4, 1) backwards;
	}
	.game::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.25) 50%, transparent 70%);
		transform: translateX(-100%);
		transition: transform 0.6s;
	}
	.game:hover {
		transform: translateY(-4px) scale(1.02);
		box-shadow: 0 16px 36px -12px var(--to);
	}
	.game:hover::after {
		transform: translateX(100%);
	}
	.emoji {
		position: absolute;
		right: 1rem;
		bottom: 0.5rem;
		font-size: 6rem;
		line-height: 1;
		filter: drop-shadow(0 6px 10px rgb(0 0 0 / 0.35));
		transition: transform 0.4s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.game:hover .emoji {
		transform: rotate(-12deg) scale(1.15);
	}
	.play {
		background: rgb(255 255 255 / 0.92);
		color: var(--to);
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
	}
</style>
