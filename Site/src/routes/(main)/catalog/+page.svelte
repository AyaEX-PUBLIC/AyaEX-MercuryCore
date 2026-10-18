<script lang="ts">
	import { untrack } from "svelte"
	import { goto } from "$app/navigation"
	import { page } from "$app/state"
	import Head from "$components/Head.svelte"
	import TabData from "$components/TabData"
	import TabNav from "$components/TabNav.svelte"
	import Assets from "./Assets.svelte"

	const tabTypes = Object.freeze({
		Hats: 8,
		"T-Shirts": 2,
		Shirts: 11,
		Pants: 12,
		Decals: 13,
		Faces: 18,
		Heads: 17,
		"Body Parts": 27,
		Gear: 19
	} as const)

	const { data } = $props()

	let tabData = $state(TabData(data.url, Object.keys(tabTypes)))

	// Keep the tab in the URL and start each tab on page 1, so pagination
	// links (and reloads) stay on the tab being viewed
	let shownTab = tabData.currentTab
	$effect(() => {
		const tab = tabData.currentTab
		if (tab === shownTab) return
		shownTab = tab
		const url = new URL(untrack(() => page.url))
		url.searchParams.set(tabData.name, tab)
		url.searchParams.delete("p")
		goto(url.pathname + url.search, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		})
	})
</script>

<Head name={data.siteName} title="Catalog" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Shop</div>
			<h1>Catalog</h1>
			<p>Hats, faces, clothing and gear to dress up your character.</p>
		</div>
		<a href="/develop" class="btn btn-tertiary">
			<fa fa-hammer></fa>
			Make your own
		</a>
	</div>

	<div class="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[13rem_minmax(0,1fr)] gap-x-10">
		<aside class="sidebar">
			<form action="/search" role="search" class="pb-5 <md:pb-4">
				<input type="hidden" name="c" value="assets" />
				<input
					type="search"
					name="q"
					required
					placeholder="Search the catalog"
					aria-label="Search the catalog" />
			</form>
			<div class="eyebrow pb-2 <md:hidden">Categories</div>
			<TabNav bind:tabData vertical />
		</aside>

		<div class="min-w-0">
			<svelte:boundary>
				<Assets {data} {tabTypes} {tabData} />

				{#snippet failed(_, reset)}
					<div class="empty">
						<b>Couldn't load the items</b>
						<p class="pb-3!">An error occurred while loading the assets.</p>
						<button class="btn btn-sm btn-tertiary" onclick={reset}>
							Retry
						</button>
					</div>
				{/snippet}
			</svelte:boundary>
		</div>
	</div>
</div>

<style>
	.sidebar {
		@media (min-width: 768px) {
			position: sticky;
			top: calc(var(--header-height) + 1.5rem);
			align-self: start;
		}
	}
</style>
