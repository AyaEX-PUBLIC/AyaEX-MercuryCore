<script lang="ts">
	import { onMount } from "svelte"
	import { goto } from "$app/navigation"
	import Head from "$components/Head.svelte"
	import PhraseMaker from "$components/PhraseMaker.svelte"
	import { answer, authApi } from "$lib/authClient"
	import LoginShell from "../../LoginShell.svelte"

	const { data } = $props()

	// the forms below need JavaScript, so wait for it before allowing submits
	let ready = $state(false)
	onMount(() => (ready = true))

	let code = $state("")
	let username = $state("")
	let busy = $state(false)
	let error = $state("")

	const descriptions: [string, string][] = [
		[
			"Reset code",
			"An administrator can give you a one-time code if you've lost your recovery phrase. It works for 24 hours."
		],
		[
			"New phrase",
			"You'll make a new recovery phrase. Your old one stops working, and every device you were logged in on is logged out."
		]
	]

	async function check(e: SubmitEvent) {
		e.preventDefault()
		busy = true
		error = ""
		try {
			;({ username } = await authApi<{ username: string }>("checkReset", {
				code
			}))
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	async function reset(phrase: string) {
		busy = true
		error = ""
		try {
			await authApi("reset", { code, ...(await answer(phrase, "reset")) })
			await goto("/home", { invalidateAll: true })
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}
</script>

<Head
	name={data.siteName}
	title="Make a new recovery phrase"
	description="Get back into your {data.siteName} account with a reset code." />

<LoginShell name={data.siteName} tagline={data.tagline} {descriptions}>
	{#if !username}
		<h2>Enter your reset code</h2>
		<p>
			Remembered your phrase?
			<a href="/login">Log in</a>
		</p>
		<form class="pt-6" onsubmit={check}>
			<label class="block pb-5">
				<span class="block pb-2">Reset code</span>
				<input
					bind:value={code}
					class="mono"
					autocomplete="one-time-code"
					autocapitalize="characters"
					spellcheck="false"
					placeholder="XXXX-XXXX-XXXX"
					required />
			</label>
			{#if error}
				<p class="text-sm text-red-400 pb-3">{error}</p>
			{/if}
			<button class="btn btn-primary w-full" disabled={!ready || busy}>
				{busy ? "Checking..." : "Continue"}
			</button>
		</form>
	{:else}
		<h2>Make a new recovery phrase</h2>
		<p class="pb-4">
			For <b class="light-text">{username}</b>. Your old phrase stops
			working once this one is saved.
		</p>
		<PhraseMaker action="Save and log in" {busy} {error} oncomplete={reset} />
	{/if}
</LoginShell>
