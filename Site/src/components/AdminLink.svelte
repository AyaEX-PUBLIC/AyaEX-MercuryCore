<script lang="ts">
	// A large link tile, used on the admin and create pages

	import type { Snippet } from "svelte"
	import type { ClassValue } from "svelte/elements"
	import fade from "$lib/fade"

	const {
		num,
		total,
		href,
		iconClass = "",
		emoji = "",
		name,
		children
	}: {
		num: number
		total: number
		href: string
		iconClass?: ClassValue
		emoji?: string
		name: string
		children?: Snippet
	} = $props()
</script>

<a
	in:fade|global={{ num, total, duration: 300 }}
	{href}
	class="tile light-text">
	{#if emoji}
		<span class="text-2xl leading-none">{emoji}</span>
	{:else}
		<fa class={["text-lg accent-text", iconClass]}></fa>
	{/if}
	<span class="font-500 pt-6">{name}</span>
	{#if children}
		<span class="grey-text text-sm pt-1">
			{@render children()}
		</span>
	{/if}
	<fa fa-arrow-right class="arrow"></fa>
</a>

<style>
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1.25rem;
		background: var(--background);
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
			& .arrow {
				opacity: 1;
				translate: 0 0;
			}
		}
	}

	.arrow {
		position: absolute;
		top: 1.375rem;
		right: 1.25rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		opacity: 0;
		translate: -0.25rem 0;
		transition:
			opacity 0.15s,
			translate 0.15s;
	}
</style>
