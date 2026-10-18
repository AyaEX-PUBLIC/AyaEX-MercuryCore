<script lang="ts">
	import { page } from "$app/state"
	import Group from "$components/Group.svelte"
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"

	let { data } = $props()
</script>

<Head name={data.siteName} title="Groups" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Community</div>
			<h1>Groups</h1>
			<p>Join groups to hang out with people who like the same things. Games can check which groups you're in.</p>
		</div>
		{#if (data.user?.permissionLevel ?? 0) >= 5}
			<a href="/groups/create" class="btn btn-primary">
				<fa fa-plus></fa>
				Create a group
			</a>
		{/if}
	</div>

	{#if data.groups.length > 0}
		<div class="tiles grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each data.groups as group, num (group.name)}
				<Group {group} {num} total={data.groups.length} />
			{/each}
		</div>
		{#key page.url}
			<Pagination totalPages={data.pages} />
		{/key}
	{:else}
		<div class="empty">
			<b>No groups yet</b>
		</div>
	{/if}
</div>
