<script lang="ts">
	import { page } from "$app/state"
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"
	import Place from "$components/Place.svelte"

	const { data } = $props()
</script>

<Head name={data.siteName} title="Discover" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Play</div>
			<h1>Games</h1>
			<p>Places made by the community. Open one and press Play to jump in.</p>
		</div>
		<a href="/games/create" class="btn btn-primary">
			<fa fa-plus></fa>
			Create a place
		</a>
	</div>

	{#if data.places.length > 0}
		<div
			class="tiles grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each data.places as place, num (place.id)}
				<Place {place} {num} total={data.places.length} />
			{/each}
		</div>
		{#key page.url}
			<Pagination totalPages={data.pages} />
		{/key}
	{:else}
		<div class="empty">
			<b>No games yet</b>
			<p>Be the first to <a href="/games/create">create one</a>!</p>
		</div>
	{/if}
</div>
