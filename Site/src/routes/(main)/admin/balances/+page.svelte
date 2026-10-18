<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
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

<div class="ctnr pb-12">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="User balances" />
			<h1>User balances</h1>
		</div>
	</div>

	<dl class="tiles grid sm:grid-cols-3 mb-6">
		<div class="stat">
			<dt class="eyebrow">Users</dt>
			<dd>{data.users.length}</dd>
		</div>
		<div class="stat">
			<dt class="eyebrow">Currency held by users</dt>
			<dd class="text-emerald-400">{data.currencySymbol}{money(total)}</dd>
		</div>
		<div class="stat">
			<dt class="eyebrow">Average balance</dt>
			<dd>{data.currencySymbol}{money(Math.round(total / (data.users.length || 1)))}</dd>
		</div>
	</dl>

	<div class="flex flex-wrap gap-2 pb-4 items-center">
		<input bind:value={search} placeholder="Search users" class="grow min-w-0 w-auto!" />
		<label class="flex items-center gap-2">
			<span class="grey-text text-sm">Sort by</span>
			<select bind:value={sort} class="w-auto">
				<option value="balance">Balance</option>
				<option value="username">Username</option>
				<option value="created">Newest</option>
			</select>
		</label>
	</div>

	<div class="panel overflow-x-auto">
	<table class="w-full m-0">
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
						<User user={user} full thin size="2rem" bg="accent" />
					</td>
					<td style="color: {colour}">{rank}</td>
					<td class="text-right mono text-emerald-400">
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
</div>

<style>
	.stat {
		padding: 1rem 1.25rem;
		& dd {
			margin: 0;
			padding-top: 0.5rem;
			font-family: var(--font-mono);
			font-size: 1.5rem;
			font-weight: 500;
		}
	}
	td {
		vertical-align: middle;
	}
</style>
