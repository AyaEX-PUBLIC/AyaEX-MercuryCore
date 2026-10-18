<script lang="ts">
	import Asset from "$components/Asset.svelte"
	import Group from "$components/Group.svelte"
	import Head from "$components/Head.svelte"
	import Place from "$components/Place.svelte"
	import UserCard from "$components/UserCard.svelte"

	const { data } = $props()

	const categoryNames: { [_: string]: string } = {
		users: "Users",
		places: "Places",
		assets: "Catalog",
		groups: "Groups"
	}
</script>

<Head name={data.siteName} title="Search for {data.query}" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Search &middot; {categoryNames[data.category] || data.category}</div>
			<h1 class="break-all">"{data.query}"</h1>
		</div>
		<nav class="flex flex-wrap gap-1" aria-label="Search in">
			{#each Object.entries(categoryNames) as [category, name]}
				{#if category !== "groups" || data.pages.includes("Groups")}
					<a
						href="/search?q={encodeURIComponent(data.query)}&c={category}"
						class={["btn btn-sm", category === data.category ? "btn-secondary" : "btn-quatenary"]}>
						{name}
					</a>
				{/if}
			{/each}
		</nav>
	</div>

	{#if data.category === "users" && data.users}
		{#if data.users.length > 0}
			<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each data.users as user, num}
					<UserCard {user} {num} total={data.users.length} />
				{/each}
			</div>
		{:else}
			{@render nothing()}
		{/if}
	{:else if data.category === "places" && data.places}
		{#if data.places.length > 0}
			<div class="tiles grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each data.places as place, num}
					<Place {place} {num} total={data.places.length} />
				{/each}
			</div>
		{:else}
			{@render nothing()}
		{/if}
	{:else if data.category === "assets" && data.assets}
		{#if data.assets.length > 0}
			<div class="tiles grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each data.assets as asset, num}
					<Asset
						{asset}
						{num}
						total={data.assets.length}
						symbol={data.currencySymbol} />
				{/each}
			</div>
		{:else}
			{@render nothing()}
		{/if}
	{:else if data.category === "groups" && data.groups}
		{#if data.groups.length > 0}
			<div class="tiles grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each data.groups as group, num}
					<Group {group} {num} total={data.groups.length} />
				{/each}
			</div>
		{:else}
			{@render nothing()}
		{/if}
	{:else}
		{@render nothing()}
	{/if}
</div>

{#snippet nothing()}
	<div class="empty">
		<b>No results</b>
		<p>Nothing matched "{data.query}". Try another word or category.</p>
	</div>
{/snippet}
