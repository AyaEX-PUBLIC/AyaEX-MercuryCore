<script lang="ts">
	import { enhance } from "$app/forms"
	import { goto } from "$app/navigation"
	import Head from "$components/Head.svelte"
	import PhraseMaker from "$components/PhraseMaker.svelte"
	import { answer, authApi } from "$lib/authClient"

	const { data } = $props()

	let busy = $state(false)
	let error = $state("")

	async function save(phrase: string) {
		busy = true
		error = ""
		try {
			await authApi("setPhrase", await answer(phrase, "phrase"))
			await goto("/home", { invalidateAll: true })
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}
</script>

<Head name={data.siteName} title="Make your recovery phrase" />

<div class="ctnr max-w-160">
	<section class="panel">
		<div class="panel-head">
			<span>Account security</span>
			<form method="post" action="/api?/logout" use:enhance>
				<button class="logout">Log out</button>
			</form>
		</div>
		<div class="p-6">
			<h1 class="pb-3">Make your recovery phrase</h1>
			<p class="grey-text">
				{data.siteName} no longer uses passwords. Instead, you sign in
				with 12 words that only you have, like a crypto wallet. Make
				yours to keep playing, {data.username}: your password is deleted
				once it's saved, and you'll stay logged in here.
			</p>
			<div class="pt-4">
				<PhraseMaker action="Save my phrase" {busy} {error} oncomplete={save} />
			</div>
		</div>
	</section>
</div>

<style>
	.logout {
		padding: 0;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: var(--primary-text);
		background: none;
		border: 0;
		cursor: pointer;
		&:hover {
			color: var(--light-text);
		}
	}
</style>
