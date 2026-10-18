<script lang="ts">
	import { page } from "$app/state"
	import Asset from "$components/Asset.svelte"
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import TabData from "$components/TabData"

	const { data } = $props()

	const tabTypes: { [_: string]: number } = Object.freeze({
		Hats: 8,
		"T-Shirts": 2,
		Shirts: 11,
		Pants: 12,
		Decals: 13,
		Faces: 18
	})

	let tabData = $state(TabData(data.url, Object.keys(tabTypes)))

	let assets = $derived(
		data.assets.filter(a => a.type === tabTypes[tabData.currentTab])
	)
</script>

<Head name={data.siteName} title="Inventory" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">You</div>
			<h1>Inventory</h1>
			<p>Everything you own. Wear items from the <a href="/character">Character</a> page.</p>
		</div>
		<a href="/catalog" class="btn btn-tertiary">
			<fa fa-book-open-cover></fa>
			Shop the catalog
		</a>
	</div>
</div>

<SidebarShell bind:tabData>
	{#if assets.length > 0}
		<div
			class="tiles grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each assets as asset, num (asset.id)}
				<Asset
					{asset}
					{num}
					total={assets.length}
					symbol={data.currencySymbol} />
			{/each}
		</div>
		{#key page.url}
			<Pagination totalPages={data.pages} />
		{/key}
	{:else}
		<div class="empty">
			<b>You don't have any {tabData.currentTab} yet</b>
			<!--
				?tab= works questionably due to url/local state mismatch...
				eh, I signed up for that
			-->
			<p>Head to the <a href="/catalog?tab={tabData.currentTab}">catalog</a> to get some!</p>
		</div>
	{/if}
</SidebarShell>
