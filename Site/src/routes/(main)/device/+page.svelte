<script lang="ts">
	import { enhance } from "$app/forms"
	import Head from "$components/Head.svelte"

	const { data, form } = $props()
</script>

<Head name={data.siteName} title="Sign in on a device" />

<div class="ctnr max-w-140">
	<section class="panel">
		<div class="panel-head"><span>Device sign-in</span></div>
		<div class="p-6">
			{#if form?.approved}
				<h1 class="pb-3">Device signed in</h1>
				<p class="grey-text">
					Your device is now signed in as {data.user.username}. You
					can close this page.
				</p>
			{:else}
				<h1 class="pb-3">Sign in on a device</h1>
				<p class="grey-text">
					Enter the code shown in the {data.siteName} app on your
					Switch, and it'll be signed in as
					<b class="light-text">{data.user.username}</b>.
				</p>
				<p class="warning">
					Only enter a code shown on your own device. Anyone who
					gives you a code is asking for your account.
				</p>
				<form method="post" use:enhance class="pt-2">
					<label class="block pb-5">
						<span class="block pb-2">Code</span>
						<input
							name="code"
							value={form?.code || ""}
							class="mono code"
							autocomplete="off"
							autocapitalize="characters"
							spellcheck="false"
							placeholder="XXXX-XXXX"
							required />
					</label>
					{#if form?.error}
						<p class="text-sm text-red-400 pb-3">{form.error}</p>
					{/if}
					<button class="btn btn-primary">
						<fa fa-check></fa>
						Approve sign-in
					</button>
				</form>
			{/if}
		</div>
	</section>
</div>

<style>
	.warning {
		margin: 0.25rem 0 1.25rem;
		padding: 0.625rem 0.875rem;
		font-size: 0.8125rem;
		color: var(--warning);
		border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
		background: color-mix(in srgb, var(--warning) 6%, transparent);
	}

	.code {
		font-size: 1.125rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
	}
</style>
