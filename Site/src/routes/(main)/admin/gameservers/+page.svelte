<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import TabData from "$components/TabData"

	const { data } = $props()

	let tabData = $state(TabData(data.url, ["Gameservers"], ["fa-server"]))
</script>

<Head name={data.siteName} title="Gameservers - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Gameservers" />
			<h1>Gameservers</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
		<table class="w-full">
		<thead>
			<tr>
				<th scope="col">ID</th>
				<th scope="col">PID</th>
				<th scope="col">Start time</th>
			</tr>
		</thead>
		<tbody>
			{#each data.gameservers as [id, g]}
				<tr>
					<td><a href="/place/{id}">{id}</a></td>
					<td>{g.pid}</td>
					<td>{new Date(g.startTime).toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</SidebarShell>

