<script lang="ts">
	import Head from "$components/Head.svelte"
	import User from "$components/User.svelte"
	import permissionLevels from "$lib/permissionLevels"

	const { data } = $props()

	let search = $state("")
	let sort: "balance" | "username" | "created" = $state("balance")

	const money = (micro: number) =>
		(micro / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })

	const total = $derived(data.users.reduce((sum, u) => sum + u.balance, 0))
	const shown = $derived(
		data.users
			.filter(u => u.username.toLowerCase().includes(search.trim().toLowerCase()))
			.toSorted((a, b) =>
				sort === "balance"
					? b.balance - a.balance
					: sort === "created"
						? b.created.localeCompare(a.created)
						: a.username.localeCompare(b.username)
			)
	)
</script>

<Head name={data.siteName} title="User balances - Admin" />

<div class="ctnr max-w-260 pb-12">
	<h1>User balances &ndash; Admin</h1>
	<a href="/admin" class="no-underline">
		<fa fa-caret-left></fa>
		Back to panel
	</a>

	<div class="grid sm:grid-cols-3 gap-4 py-6">
		<div class="card bg-darker p-4">
			<span class="grey-text text-sm">Users</span>
			<b class="text-2xl">{data.users.length}</b>
		</div>
		<div class="card bg-darker p-4">
			<span class="grey-text text-sm">Currency held by users</span>
			<b class="text-2xl text-emerald-500">{data.currencySymbol}{money(total)}</b>
		</div>
		<div class="card bg-darker p-4">
			<span class="grey-text text-sm">Average balance</span>
			<b class="text-2xl">{data.currencySymbol}{money(Math.round(total / (data.users.length || 1)))}</b>
		</div>
	</div>

	<div class="flex flex-wrap gap-2 pb-4 items-center">
		<input bind:value={search} placeholder="Search users" class="grow min-w-0" />
		<label class="flex items-center gap-2">
			<span class="grey-text text-sm">Sort by</span>
			<select bind:value={sort}>
				<option value="balance">Balance</option>
				<option value="username">Username</option>
				<option value="created">Newest</option>
			</select>
		</label>
	</div>

	<table class="w-full">
		<thead>
			<tr class="text-left">
				<th>User</th>
				<th>Rank</th>
				<th class="text-right">Balance</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each shown as user (user.id)}
				{@const [colour, , rank] = permissionLevels(user.permissionLevel)}
				<tr>
					<td class="py-1">
						<User user={user} full thin size="2.5rem" bg="accent" />
					</td>
					<td style="color: {colour}">{rank}</td>
					<td class="text-right font-bold text-emerald-500 tnum">
						{data.currencySymbol}{money(user.balance)}
					</td>
					<td class="text-right pl-4">
						<a href="/admin/balances/{user.username}" class="btn btn-sm btn-secondary no-underline">
							Manage
						</a>
					</td>
				</tr>
			{:else}
				<tr><td colspan="4" class="grey-text py-4">No users match "{search}"</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	tbody tr:nth-child(2n-1) {
		background: var(--darker);
	}
	.card {
		display: flex;
		flex-direction: column;
	}
	.tnum {
		font-feature-settings: "tnum";
	}
</style>
