<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import TabData from "$components/TabData"
	import Transaction from "$components/Transaction.svelte"
	import fade from "$lib/fade"

	const { data } = $props()

	let tabData = $state(
		TabData(data.url, ["All transactions"], ["fa-money-bill-wave"])
	)
</script>

<Head name={data.siteName} title="Transactions - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Transactions" />
			<h1>Transactions</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<table class="w-full">
		<thead>
			<tr>
				<th>Type</th>
				<th>From</th>
				<th>Time</th>
				<th>Amount</th>
				<th>Fee</th>
				<th>To</th>
				<th>Note & link</th>
			</tr>
		</thead>
		<tbody>
			{#each data.transactions as transaction, num}
				<tr
					in:fade={{
						num,
						total: data.transactions.length,
						max: 12
					}}>
					<Transaction
						{transaction}
						users={data.users}
						currencySymbol={data.currencySymbol} />
				</tr>
			{/each}
		</tbody>
	</table>
</SidebarShell>

<style>
	/* Change colour of every second row */
</style>
