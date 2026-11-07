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

<LoginShell name={data.siteName}>
	{#if data.users}
		<h2>Log in</h2>
		<p>
			<a href="/register">Register</a>
			{#if data.apply}
				· <a href="/apply">Apply</a>
			{/if}
		</p>

		<form class="pt-6" onsubmit={signIn}>
			<PhraseEntry bind:phrase autofocus />
			{#if error}
				<p class="text-sm text-red-400 pb-3">{error}</p>
			{/if}
			<button class="btn btn-primary w-full" disabled={!ready || busy || !validPhrase(phrase)}>
				{busy ? "Signing in..." : "Log in"}
			</button>
			<p class="text-sm pt-4">
				<a href="/recover/code">Lost your phrase?</a>
			</p>
		</form>

		{#if data.passwordSignIn}
			<details class="legacy" open={!!($errors.username || $errors.password)}>
				<summary>Still using a password?</summary>
				<Form {formData} action="?/password" class="pt-3" submit="Log in with password">
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
		<h2>No accounts yet</h2>
		<p>
			<a href="/register">Create the first one</a>
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
