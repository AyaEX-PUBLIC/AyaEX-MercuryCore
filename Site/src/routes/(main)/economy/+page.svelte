<script lang="ts">
	import Head from "$components/Head.svelte"
	import Transaction from "$components/Transaction.svelte"
	import beautifyCurrency from "$lib/beautifyCurrency"
	import fade from "$lib/fade"

	const { data } = $props()

	let [c1, c2, c3, c4] = $derived(beautifyCurrency(data.balance))
</script>

<Head name={data.siteName} title="Economy" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">You</div>
			<h1>Economy</h1>
			<p>Your balance and the currency you've sent and received.</p>
		</div>
	</div>

	<div class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] gap-6 items-start">
		<section class="panel">
			<div class="panel-head">Current balance</div>
			<div class="p-5">
				<div class="balance flex items-baseline">
					<span class="symbol pr-2">{data.currencySymbol}</span>
					<span class="dim">{c1}</span>{c2}<span class={c3 ? "" : "dim"}>.</span>{c3}<span class="dim">{c4}</span>
				</div>
			</div>
		</section>

		<section class="panel min-w-0">
			<div class="panel-head">Recent transactions</div>
			{#if data.transactions.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full m-0">
						<thead>
							<tr>
								<th>Type</th>
								<th>From</th>
								<th>Time</th>
								<th>Amount</th>
								<th>Fee</th>
								<th>To</th>
								<th>Note</th>
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
				</div>
			{:else}
				<p class="grey-text text-sm p-4">No transactions yet.</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.balance {
		font-family: var(--font-mono);
		font-size: 2rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		color: var(--success);
		overflow-wrap: anywhere;
	}

	.symbol {
		font-size: 1.5rem;
	}

	.dim {
		opacity: 0.35;
	}
</style>
