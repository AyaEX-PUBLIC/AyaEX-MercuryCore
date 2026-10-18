<script lang="ts">
	import { page } from "$app/state"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import UserCard from "$components/UserCard.svelte"

	const { data } = $props()
</script>

<Head name={data.siteName} title="Members of {data.name}" />

<div class="ctnr max-w-260">
	<div class="pb-4">
		<Breadcrumbs
			path={[
				["Groups", "/groups"],
				[data.name, `/groups/${page.params.group}`]
			]}
			final="Members" />
	</div>
	<h1 class="pb-8">
		Members of {data.name}
		<span class="dim-text font-400">{data.memberCount}</span>
	</h1>

	<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3">
		{#each data.members as user, num}
			<UserCard {user} {num} total={data.members.length} />
		{/each}
	</div>
</div>
