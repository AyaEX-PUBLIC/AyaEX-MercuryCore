<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import TabData from "$components/TabData"
	import AssetApprove from "./AssetApprove.svelte"

	const { data } = $props()

	let tabData = $state(
		TabData(data.url, ["Asset queue"], ["fa-file-circle-xmark"])
	)
</script>

<Head name={data.siteName} title="Asset approval - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Asset approval" />
			<h1>Asset approval</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	{#if data.assets?.length}
		<div class="tiles grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each data.assets || [] as asset, num}
				<AssetApprove {asset} {num} total={(data.assets || []).length} />
			{/each}
		</div>
	{:else}
		<div class="empty">
			<b>Nothing to review</b>
			<p>New assets waiting for approval show up here.</p>
		</div>
	{/if}
</SidebarShell>
