<script lang="ts">
	import { enhance } from "$app/forms"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"

	const { data, form } = $props()

	let status = $derived(data.status)
	let without = $derived(status.withoutPhrase)
	let percent = $derived(
		status.total ? Math.round((status.withPhrase / status.total) * 100) : 100
	)
	let confirmed = $state(false)
</script>

<Head name={data.siteName} title="Sign-in - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Sign-in" />
			<h1>Sign-in</h1>
			<p>
				Accounts sign in with a 12-word recovery phrase. Accounts made
				before phrases must make one before they can do anything else.
			</p>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2 items-start">
		<section class="panel">
			<div class="panel-head"><span>Migration</span></div>
			<dl class="kv">
				<div>
					<dt>Password sign-in</dt>
					<dd>
						{#if status.passwordSignIn}
							<span class="badge badge-warning">Open, for migrating</span>
						{:else}
							<span class="badge">
								Ended{status.ended
									? ` ${new Date(status.ended).toLocaleDateString()}`
									: ""}
							</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt>Accounts with a phrase</dt>
					<dd>{status.withPhrase} of {status.total} ({percent}%)</dd>
				</div>
			</dl>
			<div class="bar"><div style="width: {percent}%"></div></div>

			{#if status.passwordSignIn}
				<form method="post" action="?/end" use:enhance class="p-4 line-t">
					<h2 class="text-base pb-2">End password sign-in</h2>
					<p class="grey-text text-sm pb-4">
						Deletes every remaining password, so password sign-in
						stops for good. The {without.length}
						{without.length === 1 ? "account" : "accounts"} without a
						phrase will need a reset code from the Accounts page to
						get back in. Anyone already logged in without a phrase
						still has to make one first.
					</p>
					<label class="flex items-center gap-2 text-sm pb-4">
						<input type="checkbox" name="confirm" value="yes" bind:checked={confirmed} />
						I understand this can't be undone
					</label>
					{#if form?.error}
						<p class="text-sm text-red-400 pb-3">{form.error}</p>
					{/if}
					<button class="btn btn-danger" disabled={!confirmed}>
						<fa fa-key></fa>
						End password sign-in
					</button>
				</form>
			{:else if form?.deleted !== undefined}
				<p class="p-4 line-t text-sm text-emerald-400">
					Password sign-in has ended; {form.deleted}
					{form.deleted === 1 ? "password was" : "passwords were"} deleted.
				</p>
			{/if}
		</section>

		<section class="panel">
			<div class="panel-head">
				<span>Without a phrase</span>
				<span>{without.length}</span>
			</div>
			{#if without.length}
				<ul class="names">
					{#each without as name}
						<li><a href="/user/{name}" class="light-text">{name}</a></li>
					{/each}
				</ul>
			{:else}
				<p class="grey-text text-sm p-4">Every account has a phrase.</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.bar {
		height: 4px;
		margin: 0 1rem 1rem;
		background: var(--accent2);
		& div {
			height: 100%;
			background: var(--success);
		}
	}

	.names {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		max-height: 30rem;
		margin: 0;
		padding: 0.5rem 0;
		overflow-y: auto;
		list-style: none;
		font-size: 0.875rem;
		& li {
			padding: 0.25rem 1rem;
		}
	}
</style>
