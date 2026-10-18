<script lang="ts">
	import User from "$components/User.svelte"
	import beautifyCurrency from "$lib/beautifyCurrency"

	const {
		transaction,
		users,
		currencySymbol
	}: {
		transaction: import("../routes/(main)/admin/transactions/$types").PageData["transactions"][0]
		users: import("../routes/(main)/admin/transactions/$types").PageData["users"]
		currencySymbol: string
	} = $props()

	let [, c1, c2] = $derived(beautifyCurrency(transaction.Amount))
</script>

<td>
	<span
		class={[
			"badge",
			{
				"badge-success": transaction.Type === "Mint",
				"badge-danger": transaction.Type === "Burn"
			}
		]}>
		{transaction.Type}
	</span>
</td>
<td>
	{#if transaction.Type !== "Mint" && users[transaction.From]}
		<User
			user={users[transaction.From]}
			full
			thin
			size="1.75rem"
			bg="accent" />
	{/if}
</td>

<td>
	<small class="mono grey-text whitespace-nowrap">
		{new Date(transaction.Time).toLocaleString()}
	</small>
</td>
<td>
	<span class="mono text-emerald-400 whitespace-nowrap">
		{currencySymbol}{c1}{c2 ? "." : ""}{c2}
	</span>
</td>
<td>
	{#if transaction.Type === "Transaction"}
		{@const [, f1, f2] = beautifyCurrency(transaction.Fee)}
		<span class="mono text-amber-400 whitespace-nowrap">
			{currencySymbol}{f1}{f2 ? "." : ""}{f2}
		</span>
	{/if}
</td>

<td>
	{#if transaction.Type !== "Burn" && users[transaction.To]}
		<User
			user={users[transaction.To]}
			full
			thin
			size="1.75rem"
			bg="accent" />
	{/if}
</td>

<td>
	{#if transaction.Note && transaction.Type !== "Mint"}
		<a href={transaction.Link} class="light-text underline decoration-[--accent3] underline-offset-3">
			{transaction.Note}
		</a>
	{:else if transaction.Note}
		{transaction.Note}
	{:else}
		<span class="dim-text">No note</span>
	{/if}
</td>

<style>
	td {
		height: 3rem;
		vertical-align: middle;
	}
</style>
