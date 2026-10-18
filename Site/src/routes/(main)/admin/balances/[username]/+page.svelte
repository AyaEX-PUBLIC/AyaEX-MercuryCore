<script lang="ts">
	import { enhance } from "$app/forms"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import Transaction from "$components/Transaction.svelte"
	import User from "$components/User.svelte"
	import assetTypes from "$lib/assetTypes"
	import permissionLevels from "$lib/permissionLevels"
	import { encode } from "$lib/urlName"

	const { data, form } = $props()

	const money = (micro: number) =>
		(micro / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })
	const date = (iso: string | number) => new Date(iso).toLocaleString()
	const typeName = (type: number) => (type === 34 ? "Game pass" : (assetTypes[type] ?? `Type ${type}`))

	const me = $derived(data.target.username)
	const [rankColour, , rank] = $derived(permissionLevels(data.target.permissionLevel))

	// --- currency history, grouped ---
	type Tx = (typeof data.transactions)[number]
	const kinds = {
		all: "All",
		purchases: "Purchases",
		income: "Sales & income",
		casino: "Casino",
		other: "Stipends & adjustments",
	} as const
	type Kind = keyof typeof kinds
	function kindOf(tx: Tx): Exclude<Kind, "all"> {
		if (tx.Note?.startsWith("Casino:")) return "casino"
		if (tx.Type === "Transaction") return tx.From === me ? "purchases" : "income"
		if (tx.Type === "Burn" && !tx.Note?.startsWith("Adjusted by")) return "purchases" // creation fees
		return "other"
	}
	let kind: Kind = $state("all")
	const shownTx = $derived(data.transactions.filter(tx => kind === "all" || kindOf(tx) === kind))
	const counts = $derived(
		Object.fromEntries(
			(Object.keys(kinds) as Kind[]).map(k => [k, k === "all" ? data.transactions.length : data.transactions.filter(tx => kindOf(tx) === k).length])
		) as Record<Kind, number>
	)

	const sum = (list: Tx[]) => list.reduce((s, tx) => s + tx.Amount, 0)
	const stats = $derived.by(() => {
		const txs = data.transactions
		const spent = txs.filter(tx => tx.Type === "Transaction" && tx.From === me && !tx.Note?.startsWith("Casino:"))
		const earned = txs.filter(tx => tx.Type === "Transaction" && tx.To === me)
		const bets = txs.filter(tx => tx.Type === "Burn" && tx.Note?.startsWith("Casino:"))
		const wins = txs.filter(tx => tx.Type === "Mint" && tx.Note?.startsWith("Casino:"))
		return {
			spent: sum(spent),
			purchases: spent.length,
			earned: sum(earned),
			sales: earned.length,
			casino: sum(wins) - sum(bets),
			bets: bets.length,
		}
	})

	// what was paid for each item, from the ledger (matched by its purchase note)
	const paid = $derived.by(() => {
		const map = new Map<string, number>()
		for (const tx of data.transactions)
			if (tx.Type === "Transaction" && tx.From === me && tx.Note) map.set(tx.Note, tx.Amount)
		return map
	})
	function paidFor(item: (typeof data.owned)[number]) {
		if (item.creator === me) return "Their creation"
		const amount = paid.get(`Purchased ${item.type === 34 ? "game pass" : "asset"} ${item.name}`)
		if (amount !== undefined) return `${data.currencySymbol}${money(amount)}`
		return item.price > 0 ? "Not in ledger" : "Free"
	}

	let section: "purchases" | "products" | "history" = $state("purchases")
	let ownedSearch = $state("")
	const shownOwned = $derived(
		data.owned.filter(o => o.name.toLowerCase().includes(ownedSearch.trim().toLowerCase()))
	)

	let amount = $state("")
	let busy = $state(false)
</script>

<Head name={data.siteName} title="{me}'s currency - Admin" />

<div class="ctnr pb-12">
	<div class="page-head">
		<div>
			<Breadcrumbs
				path={[
					["Admin", "/admin"],
					["User balances", "/admin/balances"]
				]}
				final={me} />
			<h1>{me}'s currency</h1>
		</div>
	</div>

	<div class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
		<div class="panel p-4 flex flex-col gap-3">
			<div class="flex items-center gap-3">
				<User user={data.target} full thin size="3rem" bg="accent" />
				<span style="color: {rankColour}">{rank}</span>
			</div>
			<span class="grey-text text-sm">
				Joined {date(data.target.created)} · last online {date(data.target.lastOnline)}
			</span>
			<div>
				<span class="grey-text text-sm">Balance</span>
				<div class="text-4xl font-bold text-emerald-500 tnum">
					{data.currencySymbol}{money(data.balance)}
				</div>
			</div>
			<div class="grid grid-cols-3 gap-2 text-sm">
				<div>
					<span class="grey-text">Spent on items</span>
					<b class="block">{data.currencySymbol}{money(stats.spent)}</b>
					<span class="grey-text">{stats.purchases} purchases</span>
				</div>
				<div>
					<span class="grey-text">Earned from sales</span>
					<b class="block">{data.currencySymbol}{money(stats.earned)}</b>
					<span class="grey-text">{stats.sales} sales</span>
				</div>
				<div>
					<span class="grey-text">Casino net</span>
					<b class="block {stats.casino < 0 ? 'text-red-500' : 'text-emerald-500'}">
						{stats.casino < 0 ? "−" : "+"}{data.currencySymbol}{money(Math.abs(stats.casino))}
					</b>
					<span class="grey-text">{stats.bets} bets</span>
				</div>
			</div>
		</div>

		<form
			method="post"
			action="?/adjust"
			class="panel p-4 flex flex-col gap-3"
			use:enhance={() => {
				busy = true
				return async ({ update, result }) => {
					await update({ reset: false })
					if (result.type === "success") amount = ""
					busy = false
				}
			}}>
			<h2 class="text-lg">Change balance</h2>
			<label class="flex flex-col gap-1">
				<span class="grey-text text-sm">Amount ({data.currencySymbol})</span>
				<input name="amount" type="number" min="0" step="0.000001" required bind:value={amount} placeholder="e.g. 250" />
			</label>
			<label class="flex flex-col gap-1">
				<span class="grey-text text-sm">Reason (shown in their transaction history and the audit log)</span>
				<input name="reason" maxlength="200" placeholder="Optional" />
			</label>
			<div class="flex flex-wrap gap-2">
				<button name="mode" value="add" class="btn btn-primary" disabled={busy}>
					<fa fa-plus></fa>
					Add
				</button>
				<button name="mode" value="remove" class="btn btn-red-secondary" disabled={busy}>Remove</button>
				<button name="mode" value="set" class="btn btn-secondary" disabled={busy}>Set balance to amount</button>
			</div>
			{#if form?.adjust}
				<p class={form.ok ? "text-emerald-500" : "text-yellow-500"}>{form.adjust}</p>
			{/if}
		</form>
	</div>

	<div class="flex flex-wrap gap-2 pt-8 pb-4">
		<button class="btn btn-sm {section === 'purchases' ? 'btn-primary' : 'btn-secondary'}" onclick={() => (section = "purchases")}>
			Items acquired ({data.owned.length})
		</button>
		<button class="btn btn-sm {section === 'products' ? 'btn-primary' : 'btn-secondary'}" onclick={() => (section = "products")}>
			Developer products ({data.receipts.length})
		</button>
		<button class="btn btn-sm {section === 'history' ? 'btn-primary' : 'btn-secondary'}" onclick={() => (section = "history")}>
			Currency history ({data.transactions.length})
		</button>
	</div>

	{#if section === "purchases"}
		<input bind:value={ownedSearch} placeholder="Search items" class="w-full mb-3" />
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="text-left">
						<th>Item</th>
						<th>Type</th>
						<th>Creator</th>
						<th>Acquired</th>
						<th class="text-right">Paid</th>
					</tr>
				</thead>
				<tbody>
					{#each shownOwned as item (item.asset)}
						<tr>
							<td class="py-2">
								<a href={item.type === 34 && item.place ? `/place/${item.place}` : `/catalog/${item.asset}/${encode(item.name) || "item"}`}>
									{item.name}
								</a>
							</td>
							<td>{typeName(item.type)}</td>
							<td>{item.creator ?? ""}</td>
							<td class="text-sm">{date(item.created)}</td>
							<td class="text-right tnum">{paidFor(item)}</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="grey-text py-4">No items</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if section === "products"}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="text-left">
						<th>Product</th>
						<th>Place</th>
						<th>Bought</th>
						<th>Status</th>
						<th class="text-right">Price</th>
					</tr>
				</thead>
				<tbody>
					{#each data.receipts as receipt (receipt.id)}
						<tr>
							<td class="py-2">{receipt.name} <span class="grey-text text-xs">#{receipt.product}</span></td>
							<td><a href="/place/{receipt.place}">{receipt.placeName}</a></td>
							<td class="text-sm">{date(receipt.created)}</td>
							<td class={receipt.completed ? "text-emerald-500" : "text-yellow-500"}>
								{receipt.completed ? "Granted in game" : "Pending"}
							</td>
							<td class="text-right tnum">{data.currencySymbol}{receipt.price}</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="grey-text py-4">No developer product purchases</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="flex flex-wrap gap-2 pb-3">
			{#each Object.entries(kinds) as [key, label]}
				<button
					class="btn btn-sm {kind === key ? 'btn-primary' : 'btn-secondary'}"
					onclick={() => (kind = key as Kind)}>
					{label} ({counts[key as Kind]})
				</button>
			{/each}
		</div>
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="text-left">
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
					{#each shownTx as transaction (transaction.Id)}
						<tr>
							<Transaction {transaction} users={data.users} currencySymbol={data.currencySymbol} />
						</tr>
					{:else}
						<tr><td colspan="7" class="grey-text py-4">Nothing here</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if data.transactions.length >= 2000}
			<p class="grey-text text-sm pt-2">Showing the latest 2000 transactions.</p>
		{/if}
	{/if}
</div>

<style>
	td {
		padding-right: 0.75rem;
	}
	.tnum {
		font-feature-settings: "tnum";
	}
</style>
