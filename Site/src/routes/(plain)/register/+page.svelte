<script lang="ts">
	import { onMount } from "svelte"
	import { goto } from "$app/navigation"
	import { page } from "$app/state"
	import Head from "$components/Head.svelte"
	import PhraseMaker from "$components/PhraseMaker.svelte"
	import { answer, authApi } from "$lib/authClient"
	import LoginShell from "../LoginShell.svelte"

	const { data } = $props()

	type Errors = { username?: string; email?: string; regkey?: string }

	// the forms below need JavaScript, so wait for it before allowing submits
	let ready = $state(false)
	onMount(() => (ready = true))

	// an invite link (or an accepted application) fills these in
	const params = page.url.searchParams
	let details = $state({
		username: params.get("username") || "",
		email: "",
		regkey: params.get("invite") || ""
	})
	let errors: Errors = $state({})
	let step: "details" | "phrase" = $state("details")
	let busy = $state(false)
	let error = $state("")

	const descriptions: [string, string][] = [
		[
			"Unique username",
			"Make sure it is appropriate and between 3-21 characters. Letters A-Z, numbers 0-9, and underscores are allowed."
		],
		[
			"Recovery phrase",
			"Instead of a password, you get 12 words to sign in with, like a crypto wallet. Write them down: they're the only way into your account."
		]
	]
	if (data.emailsEnabled)
		descriptions.splice(1, 0, [
			"Valid email",
			`${data.siteName} requires a valid email so you can be contacted by administrators for critical account issues.`
		])

	async function check(e: SubmitEvent) {
		e.preventDefault()
		busy = true
		error = ""
		try {
			const result = await authApi<{ errors?: Errors }>(
				"checkRegistration",
				details
			)
			errors = result.errors || {}
			if (!result.errors) step = "phrase"
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	async function create(phrase: string) {
		busy = true
		error = ""
		try {
			const result = await authApi<{ errors?: Errors }>("register", {
				...details,
				...(await answer(phrase, "register"))
			})
			if (result.errors) {
				// e.g. someone took the username meanwhile
				errors = result.errors
				step = "details"
			} else await goto("/home", { invalidateAll: true })
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}
</script>

<Head
	name={data.siteName}
	title="Register"
	description="Create a {data.siteName} account." />

{#snippet field(
	name: keyof Errors,
	label: string,
	placeholder: string,
	autocomplete: import("svelte/elements").FullAutoFill = "off",
	required = true
)}
	<label class="block pb-5">
		<span class="block pb-2">{label}</span>
		<input
			bind:value={details[name]}
			{placeholder}
			{autocomplete}
			class={{ "is-invalid": errors[name] }}
			{required} />
		{#if errors[name]}
			<small class="block text-red-400 pt-1">{errors[name]}</small>
		{/if}
	</label>
{/snippet}

<LoginShell name={data.siteName} tagline={data.tagline} {descriptions}>
	{#if step === "details"}
		{#if data.users}
			<h2>Create a free account</h2>
			<p>
				Already have an account?
				<a href="/login">Log in</a>
			</p>
		{:else}
			<h2>Create the initial account</h2>
			<p class="pt-2">
				This will be the first user account on this Mercury Core
				instance! It will automatically have the highest permission
				level. After logging in, create registration keys in the Admin
				panel to let more people join.
			</p>
		{/if}

		{#if data.users && data.mode === "closed"}
			<p class="pt-4">
				Registration is closed right now. Check back later.
			</p>
		{:else}
		<form class="pt-6" onsubmit={check}>
			{@render field("username", "Username", "3-21 characters", "username")}
			{#if data.users && data.emailsEnabled}
				{@render field("email", "Email address", `${data.siteName}@${data.domain}`, "email")}
			{/if}
			{#if data.users && data.mode === "invite"}
				{@render field("regkey", "Invite code", `${data.prefix}1nv1t3c0d3`)}
			{:else if data.users}
				{@render field("regkey", "Invite code (optional)", `${data.prefix}1nv1t3c0d3`, "off", false)}
			{/if}
			{#if error}
				<p class="text-sm text-red-400 pb-3">{error}</p>
			{/if}
			<button class="btn btn-primary w-full" disabled={!ready || busy}>
				{busy ? "Checking..." : "Continue"}
			</button>
			{#if data.users && data.mode === "invite" && data.applications}
				<p class="text-sm grey-text pt-4">
					No invite? <a href="/apply">Apply to join</a>
				</p>
			{/if}
		</form>
		{/if}
	{:else}
		<h2>Your recovery phrase</h2>
		<p class="pb-4">
			You'll sign in as <b class="light-text">{details.username}</b> with
			these words instead of a password.
		</p>
		<PhraseMaker action="Create account" {busy} {error} oncomplete={create} />
		<button
			type="button"
			class="btn btn-sm btn-tertiary mt-4"
			disabled={busy}
			onclick={() => (step = "details")}>
			<fa fa-arrow-left></fa>
			Change details
		</button>
	{/if}
</LoginShell>
