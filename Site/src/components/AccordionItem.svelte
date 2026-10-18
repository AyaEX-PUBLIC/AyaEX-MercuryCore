<script lang="ts">
	import type { Accordion, AccordionItem } from "melt/builders"
	import type { Snippet } from "svelte"
	import { slide } from "svelte/transition"
	import NoScript from "$components/NoScript.svelte"
	import YesScript from "$components/YesScript.svelte"

	const {
		accordion,
		ai,
		children
	}: {
		accordion: Accordion
		ai: AccordionItem<{
			title: string
		}>
		children: Snippet
	} = $props()

	let item = $derived(accordion.getItem(ai))
</script>

<NoScript>
	<details name="details" class="panel">
		<summary class="p-3 px-4 block text-sm font-500">
			{item.item.title}
		</summary>
		{@render children()}
	</details>
</NoScript>
<YesScript>
	<div class="panel">
		<button
			{...item.trigger}
			class="btn light-text px-4 py-3 w-full justify-between! text-left">
			{item.item.title}
			<fa
				fa-plus
				class={["grey-text transition-transform", { "rotate-45": item.isExpanded }]}>
			</fa>
		</button>

		{#if item.isExpanded}
			<div {...item.content} transition:slide>
				{@render children()}
			</div>
		{/if}
	</div>
</YesScript>
