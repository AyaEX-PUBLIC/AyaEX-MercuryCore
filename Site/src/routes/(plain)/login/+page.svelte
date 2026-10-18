<script lang="ts">
	import { onMount } from "svelte"
	import { goto } from "$app/navigation"
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Head from "$components/Head.svelte"
	import PhraseEntry from "$components/PhraseEntry.svelte"
	import { answer, authApi } from "$lib/authClient"
	import { validPhrase } from "$lib/phrase"
	import { superForm } from "$lib/validate"
	import LoginShell from "../LoginShell.svelte"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	let { errors } = $derived(formData)

	// the forms below need JavaScript, so wait for it before allowing submits
	let ready = $state(false)
	onMount(() => (ready = true))

	let phrase = $state("")
	let busy = $state(false)
	let error = $state("")

	async function signIn(e: SubmitEvent) {
		e.preventDefault()
		if (!validPhrase(phrase) || busy) return
		busy = true
		error = ""
		try {
			await authApi("login", await answer(phrase, "login"))
			phrase = ""
			await goto("/home", { invalidateAll: true })
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}
</script>

<Head
	name={data.siteName}
	title="Log in"
	description="Log into your {data.siteName} account." />

<LoginShell
	name={data.siteName}
	tagline={data.tagline}
	descriptions={data.descriptions}>
	{#if data.users}
		<h2>Log into your account</h2>
		<p>
			Don't yet have an account?
			<a href="/register">Register</a>
		</p>

		<form class="pt-6" onsubmit={signIn}>
			<PhraseEntry bind:phrase autofocus />
			{#if error}
				<p class="text-sm text-red-400 pb-3">{error}</p>
			{/if}
			<button class="btn btn-primary w-full" disabled={!ready || busy || !validPhrase(phrase)}>
				{busy ? "Signing in..." : "Log in"}
			</button>
			<p class="text-sm grey-text pt-4">
				Lost your phrase? Ask an administrator for a reset code, then
				<a href="/recover/code">make a new phrase</a>.
			</p>
		</form>

		{#if data.passwordSignIn}
			<details class="legacy" open={!!($errors.username || $errors.password)}>
				<summary>Haven't made a recovery phrase yet?</summary>
				<p class="text-sm grey-text pt-3">
					{data.siteName} now uses recovery phrases instead of
					passwords. Log in with your password one last time to make
					yours.
				</p>
				<Form {formData} action="?/password" class="pt-2" submit="Log in with password">
					<Input
						{formData}
						column
						autocomplete="username"
						name="username"
						label="Username"
						placeholder="Username" />
					<Input
						{formData}
						column
						autocomplete="current-password"
						name="password"
						label="Password"
						type="password"
						placeholder={"•".repeat(18)} />
				</Form>
			</details>
		{/if}
	{:else}
		<h2>There are no users registered in the database yet!</h2>
		<p class="pt-4">
			Perhaps you've just set up Mercury Core. Perhaps you've already set
			it up before, and something has gone terribly wrong with your
			database.
		</p>
		<p class="pt-2">
			If it's the former, head to the
			<a href="/register">Register</a>
			page to create the first user!
		</p>
	{/if}
</LoginShell>

<style>
	.legacy {
		margin-top: 1.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--accent2);
		& summary {
			font-size: 0.875rem;
			color: var(--primary-text);
			cursor: pointer;
		}
	}
</style>
