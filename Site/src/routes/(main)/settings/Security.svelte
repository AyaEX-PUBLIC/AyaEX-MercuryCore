<script lang="ts">
	import { enhance } from "$app/forms"
	import PhraseEntry from "$components/PhraseEntry.svelte"
	import PhraseMaker from "$components/PhraseMaker.svelte"
	import { answer, authApi } from "$lib/authClient"
	import { validPhrase } from "$lib/phrase"

	const { data }: { data: import("./$types").PageData } = $props()

	// Replacing the phrase: check the current one, then make a new one
	let step: "idle" | "current" | "new" = $state("idle")
	let current = $state("")
	let busy = $state(false)
	let error = $state("")
	let done = $state(false)

	async function checkCurrent(e: SubmitEvent) {
		e.preventDefault()
		busy = true
		error = ""
		try {
			await authApi("checkPhrase", await answer(current, "replace"))
			step = "new"
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	async function replace(next: string) {
		busy = true
		error = ""
		try {
			await authApi("replacePhrase", {
				current: await answer(current, "replace"),
				next: await answer(next, "phrase")
			})
			current = ""
			step = "idle"
			done = true
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}
</script>

<h3 class="text-base pb-2">Recovery phrase</h3>
<p class="grey-text text-sm pb-5">
	You sign in with your 12-word phrase. Replacing it logs you out on every
	other device, and the old phrase stops working.
</p>

{#if step === "idle"}
	{#if done}
		<p class="text-sm text-emerald-400 pb-4">Your new phrase is saved.</p>
	{/if}
	<button
		type="button"
		class="btn btn-secondary"
		onclick={() => {
			step = "current"
			done = false
			error = ""
		}}>
		<fa fa-key></fa>
		Replace recovery phrase
	</button>
{:else if step === "current"}
	<form onsubmit={checkCurrent} class="max-w-120">
		<PhraseEntry bind:phrase={current} label="Your current phrase" autofocus />
		{#if error}
			<p class="text-sm text-red-400 pb-3">{error}</p>
		{/if}
		<div class="flex gap-2">
			<button type="button" class="btn btn-tertiary" onclick={() => (step = "idle")}>
				Cancel
			</button>
			<button class="btn btn-primary" disabled={busy || !validPhrase(current)}>
				{busy ? "Checking..." : "Continue"}
			</button>
		</div>
	</form>
{:else}
	<div class="max-w-120">
		<PhraseMaker action="Replace phrase" {busy} {error} oncomplete={replace} />
		<button
			type="button"
			class="btn btn-sm btn-tertiary mt-4"
			disabled={busy}
			onclick={() => {
				step = "idle"
				current = ""
			}}>
			Cancel
		</button>
	</div>
{/if}

<h3 class="text-base pt-6 mt-6 line-t">Sessions</h3>

<p class="grey-text text-sm pt-2 pb-5">
	Invalidate all of your account sessions. <span class="text-red-400">
		This logs you out of {data.siteName} on all browsers and devices.
	</span>
	Use in the event of a security breach.
</p>

<form method="post" action="?/sessions" use:enhance>
	<button class="btn btn-red-secondary">
		<fa fa-explosion></fa>
		Invalidate all sessions
	</button>
</form>
