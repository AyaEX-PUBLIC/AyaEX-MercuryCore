<script lang="ts">
	import { enhance } from "$app/forms"
	import { page } from "$app/state"
	import Head from "$components/Head.svelte"
	import LoginShell from "../LoginShell.svelte"

	const { data, form } = $props()

	let busy = $state(false)
	let copied = $state(false)

	let statusLink = $derived(
		form?.code ? `${page.url.origin}/apply/status#${form.code}` : ""
	)

	const descriptions: [string, string][] = [
		[
			"No invite?",
			"Tell us a little about yourself and staff will look at your application."
		],
		[
			"Keep your link",
			"You'll get a private link to check on it. If you're accepted, it gives you your invite."
		]
	]

	async function copy() {
		try {
			await navigator.clipboard.writeText(statusLink)
			copied = true
		} catch {}
	}
</script>

<Head
	name={data.siteName}
	title="Apply to join"
	description="Apply to join {data.siteName}." />

<LoginShell name={data.siteName} tagline={data.tagline} {descriptions}>
	{#if form?.code}
		<h2>Application sent</h2>
		<p class="pb-4">
			Save this link: it's the only way to check your application, and
			it gives you your invite if you're accepted.
		</p>
		<div class="link mono">{statusLink}</div>
		<div class="flex gap-2 pt-3">
			<button type="button" class="btn btn-tertiary btn-sm" onclick={copy}>
				<fa fa-copy></fa>
				{copied ? "Copied" : "Copy link"}
			</button>
			<a href={statusLink} class="btn btn-primary btn-sm">Check it now</a>
		</div>
	{:else if !data.open}
		<h2>Applications are closed</h2>
		<p class="pt-2">
			{data.siteName} isn't taking applications right now. If someone
			gives you an invite, you can
			<a href="/register">register</a>
			with it.
		</p>
	{:else}
		<h2>Apply to join</h2>
		<p>
			Have an invite?
			<a href="/register">Register</a>
		</p>
		<form
			method="post"
			class="pt-6"
			use:enhance={() => {
				busy = true
				return async ({ update }) => {
					await update({ reset: false })
					busy = false
				}
			}}>
			<label class="block pb-5">
				<span class="block pb-2">Username you'd like</span>
				<input
					name="username"
					value={form?.username || ""}
					autocomplete="username"
					placeholder="3-21 characters"
					required
					minlength="3"
					maxlength="21" />
			</label>
			<label class="block pb-5">
				<span class="block pb-2">{data.question}</span>
				<textarea name="about" rows="5" required minlength="20" maxlength="1000">{form?.about || ""}</textarea>
			</label>
			<label class="block pb-5">
				<span class="block pb-2">How can staff reach you? <span class="grey-text">(optional)</span></span>
				<input
					name="contact"
					value={form?.contact || ""}
					maxlength="200"
					placeholder="e.g. your Discord username" />
			</label>
			{#if form?.error}
				<p class="text-sm text-red-400 pb-3">{form.error}</p>
			{/if}
			<button class="btn btn-primary w-full" disabled={busy}>
				{busy ? "Sending..." : "Send application"}
			</button>
		</form>
	{/if}
</LoginShell>

<style>
	.link {
		padding: 0.625rem 0.75rem;
		font-size: 0.8125rem;
		word-break: break-all;
		background: var(--darker);
		border: 1px solid var(--accent2);
		user-select: all;
	}
</style>
