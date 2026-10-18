<script lang="ts">
	// Tabs in a column on the left, with the current tab's content beside them
	import type TabData from "$components/TabData"
	import TabNav from "$components/TabNav.svelte"
	import type { ClassValue } from "svelte/elements"

	let {
		tabData = $bindable(),
		space = false,
		children,
		class: class_ = ""
	}: {
		tabData: ReturnType<typeof TabData>
		/** Wider: the content isn't limited to the container's width */
		space?: boolean
		children?: import("svelte").Snippet
		class?: ClassValue
	} = $props()
</script>

<div class={["ctnr shell", { "max-w-full": space }, class_]}>
	<aside>
		<TabNav bind:tabData vertical />
	</aside>
	<div class="min-w-0">
		{@render children?.()}
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0 2.5rem;
		@media (min-width: 768px) {
			grid-template-columns: 13rem minmax(0, 1fr);
		}
	}

	aside {
		@media (min-width: 768px) {
			position: sticky;
			top: calc(var(--header-height) + 1.5rem);
			align-self: start;
		}
	}
</style>
