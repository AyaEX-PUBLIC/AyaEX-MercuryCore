<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import TabData from "$components/TabData"
	import User from "$components/User.svelte"
	import Report from "./Report.svelte"

	const { data } = $props()

	let tabData = $state(TabData(data.url, ["Abuse reports"], ["fa-list"]))
</script>

<Head name={data.siteName} title="Abuse reports - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Abuse reports" />
			<h1>Abuse reports</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<table class="w-full">
		<thead>
			<tr>
				<th scope="col">Id</th>
				<th scope="col">Category</th>
				<th scope="col">Reporter</th>
				<th scope="col">Reportee</th>
				<th scope="col">Time</th>
			</tr>
		</thead>
		<tbody>
			{#each data.reports as report}
				<tr>
					<td class="max-w-35">
						<button
							class="btn btn-sm btn-tertiary"
							popovertarget={report.id}>
							{report.id}
						</button>
					</td>
					<td class="max-w-35">{report.category}</td>
					<td><User user={report.reporter} full thin /></td>
					<td><User user={report.reportee} full thin /></td>
					<td>{new Date(report.time).toLocaleString()}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</SidebarShell>

{#each data.reports as report}
	<Report {report} />
{/each}
