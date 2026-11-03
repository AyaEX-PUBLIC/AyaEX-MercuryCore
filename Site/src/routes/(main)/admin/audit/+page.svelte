<script lang="ts">
	import { page } from "$app/state"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import TabData from "$components/TabData"
	import User from "$components/User.svelte"

	const { data } = $props()

	let tabData = $state(TabData(data.url, ["Audit logs"], ["fa-list"]))

	const colours = Object.freeze({
		Account: "text-sky-500",
		Administration: "text-red-500",
		Economy: "text-yellow-500",
		Moderation: "text-emerald-500"
	})
</script>

<Head name={data.siteName} title="Audit logs - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Audit logs" />
			<h1>Audit logs</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<table class="w-full">
		<thead>
			<tr>
				<th scope="col">Action</th>
				<th scope="col">Note</th>
				<th scope="col">User</th>
				<th scope="col">Time</th>
			</tr>
		</thead>
		<tbody>
			{#each data.logs as log}
				<tr>
					<td class={colours[log.action]}>{log.action}</td>
					<td>{log.note}</td>
					<td><User user={log.user} full thin /></td>
					<td>{log.created.toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#key page.url}
		<Pagination totalPages={data.pages} />
	{/key}
</SidebarShell>

