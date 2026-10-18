<script lang="ts">
	import { enhance } from "$app/forms"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import User from "$components/User.svelte"

	const { data, form } = $props()

	let tabData = $state(
		TabData(data.url, ["Reset code", "Users"], ["fa-key", "fa-user"])
	)
</script>

<Head name={data.siteName} title="Accounts - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Accounts" />
			<h1>Accounts</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<Tab bind:tabData>
		<p class="grey-text text-sm pb-5 max-w-150">
			Accounts sign in with a recovery phrase that only their owner has.
			If someone loses theirs, give them a reset code: they enter it at
			<span class="mono">/recover/code</span> to make a new phrase. A code
			works once, for 24 hours, and replaces any earlier code.
		</p>
		<form method="post" action="?/resetCode" use:enhance class="max-w-100">
			<label class="block pb-5">
				<span class="block pb-2">Username</span>
				<input name="username" value={form?.username || ""} required />
			</label>
			{#if form?.error}
				<p class="text-sm text-red-400 pb-3">{form.error}</p>
			{/if}
			<button class="btn btn-primary">
				<fa fa-key></fa>
				Make reset code
			</button>
		</form>
		{#if form?.code}
			<div class="code panel">
				<span class="eyebrow">Reset code for {form.username}</span>
				<span class="mono">{form.code}</span>
				<span class="grey-text text-xs">
					Shown only once. Give it to them privately.
				</span>
			</div>
		{/if}
	</Tab>
	<Tab bind:tabData>
		<table class="w-full">
			<tbody>
				{#each data.users as user}
					<tr>
						<td><User {user} full thin bg="accent" /></td>
						<td class="text-right">
							{#if user.hasPhrase}
								<span class="badge badge-success">Phrase</span>
							{:else}
								<span class="badge badge-warning">No phrase yet</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Tab>
</SidebarShell>

<style>
	.code {
		gap: 0.375rem;
		max-width: 25rem;
		margin-top: 1.5rem;
		padding: 1rem;
		border-color: var(--primary-line);
		& .mono {
			font-size: 1.375rem;
			letter-spacing: 0.08em;
			user-select: all;
		}
	}
</style>
