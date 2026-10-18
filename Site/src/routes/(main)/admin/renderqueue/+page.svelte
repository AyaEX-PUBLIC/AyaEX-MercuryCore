<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import User from "$components/User.svelte"

	const { data } = $props()

	let tabData = $state(
		TabData(
			data.url,
			["Status", "Render Queue"],
			["fa-check-circle", "fa-bars-progress"]
		)
	)

	const current = data.queue[0]
</script>

<Head name={data.siteName} title="Render queue - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Render queue" />
			<h1>Render queue</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<Tab bind:tabData>
		<div class="grid lg:grid-cols-2 gap-6 items-start">
			<div class="panel">
				<div class="panel-head">
					<span>Render server</span>
					<span class="badge badge-success">
						<span class="dot on"></span>
						Active
					</span>
				</div>
				<div class="p-4 flex flex-col gap-1.5 text-sm">

				<div>
					<fa fa-image class="text-emerald-600 pr-1"></fa>
					<b>0 renders</b>
					Completed
				</div>
				<div>
					<fa fa-bars-progress class="text-yellow-500 pr-1"></fa>
					<b>0 renders</b>
					Pending
				</div>
				<div>
					<fa fa-image-slash class="text-red-500 pr-1"></fa>
					<b>0 renders</b>
					Failed
				</div>
				</div>
			</div>
			<div class="panel">
				<div class="panel-head">Currently rendering</div>
				{#if current}
					<div class="overflow-x-auto">
					<table class="w-full m-0">
						<thead>
							<tr>
								<th scope="col">Task ID</th>
								<th scope="col">Render Type</th>
								<th scope="col">User/Asset Requested</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th scope="row">{current.id}</th>
								<td>{current.type}</td>
								<td>
									{#if current.user}
										<User user={current.user} full thin />
									{:else if current.asset}
										{current.asset.name}
									{:else}
										Unknown
									{/if}
								</td>
							</tr>
						</tbody>
					</table>
					</div>
				{:else}
					<p class="grey-text text-sm p-4">No renders currently in progress.</p>
				{/if}
			</div>
		</div>
	</Tab>
	<Tab bind:tabData>
		<div class="panel overflow-x-auto">
		<table id="rendertable" class="w-full m-0">
			<thead>
				<tr>
					<th scope="col">Task id</th>
					<th scope="col">Render type</th>
					<th scope="col">User/Asset requested</th>
					<th scope="col">Status</th>
					<th scope="col">Time started</th>
					<th scope="col">Time completed</th>
				</tr>
			</thead>
			<tbody>
				{#each data.queue as task}
					<tr>
						<td>{task.id}</td>
						<td>{task.type}</td>
						{#if task.user}
							<td>
								<User user={task.user} full thin />
							</td>
						{:else if task.asset}
							<td>{task.asset.name}</td>
						{:else}
							<td>Unknown</td>
						{/if}
						<td>{task.status}</td>
						<td>
							{new Date(task.created).toLocaleString()}
						</td>
						<td>
							{task.completed
								? new Date(task.completed).toLocaleString()
								: "N/A"}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		</div>
	</Tab>
</SidebarShell>

<style>
	#rendertable td {
		height: 3rem;
		vertical-align: middle;
	}
</style>
