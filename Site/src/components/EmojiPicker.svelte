<script lang="ts">
	// The shoutbox emoji picker, with a search and one tab per category.
	// Shift-click picks several without closing it.

	import type { categories as Categories, Emoji } from "$lib/shoutbox/emoji"

	const {
		categories,
		onpick,
		onclose
	}: {
		categories: typeof Categories
		onpick: (emoji: string, keepOpen: boolean) => void
		onclose: () => void
	} = $props()

	let query = $state("")
	let tab = $state(0)
	let hovered: Emoji | null = $state(null)

	let shown = $derived.by(() => {
		const q = query.trim().toLowerCase().replaceAll(":", "")
		if (!q) return categories[tab].emoji
		return categories
			.flatMap(c => c.emoji)
			.filter(e => e.names.some(n => n.includes(q)))
	})

	const focus = (node: HTMLInputElement) => node.focus()
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="picker" onkeydown={e => e.key === "Escape" && onclose()}>
	<input
		type="search"
		bind:value={query}
		placeholder="Search emoji"
		aria-label="Search emoji"
		{@attach focus} />
	{#if !query}
		<div class="tabs" role="tablist">
			{#each categories as category, i}
				<button
					type="button"
					role="tab"
					aria-selected={tab === i}
					title={category.name}
					onclick={() => (tab = i)}>
					{category.emoji[0].emoji}
				</button>
			{/each}
		</div>
	{/if}
	<div class="grid">
		{#each shown as e (e.emoji)}
			<button
				type="button"
				title=":{e.names[0]}:"
				onclick={ev => onpick(e.emoji, ev.shiftKey)}
				onmouseenter={() => (hovered = e)}
				onfocus={() => (hovered = e)}>
				{e.emoji}
			</button>
		{:else}
			<p class="dim-text text-sm p-3">No emoji found</p>
		{/each}
	</div>
	<div class="name mono">
		{#if hovered}
			<span class="emoji">{hovered.emoji}</span>
			:{hovered.names[0]}:
		{:else}
			Tip: type :name: in a message
		{/if}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		width: min(20rem, calc(100vw - 2rem));
		background: var(--background);
		border: 1px solid var(--accent3);
		& input {
			font-size: 0.8125rem;
			padding: 0.5rem 0.75rem;
			border: 0;
			border-bottom: 1px solid var(--accent2);
			background: var(--darker);
			color: var(--light-text);
			outline: none;
		}
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid var(--accent2);
		& button {
			flex: 1;
			padding: 0.375rem 0;
			font-size: 1rem;
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			cursor: pointer;
			filter: grayscale(1);
			opacity: 0.7;
			&:hover,
			&[aria-selected="true"] {
				filter: none;
				opacity: 1;
			}
			&[aria-selected="true"] {
				border-bottom-color: var(--primary);
			}
		}
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		align-content: start;
		height: 13rem;
		padding: 0.25rem;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		& button {
			aspect-ratio: 1;
			font-size: 1.25rem;
			line-height: 1;
			background: none;
			border: 0;
			cursor: pointer;
			&:hover,
			&:focus-visible {
				background: var(--accent2);
				outline: none;
			}
		}
		& p {
			grid-column: 1 / -1;
		}
	}

	.name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.25rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		border-top: 1px solid var(--accent2);
		overflow: hidden;
		white-space: nowrap;
		& .emoji {
			font-size: 1.125rem;
		}
	}
</style>
