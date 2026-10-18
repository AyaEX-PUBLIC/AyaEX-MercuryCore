<script lang="ts">
	// Makes a new recovery phrase: shows it to write down, then checks a few
	// of the words. The phrase is made here in the browser, after the page
	// loads, so it's never sent anywhere.

	import { onMount } from "svelte"
	import { newPhrase, normalise, phraseLength } from "$lib/phrase"

	const {
		action = "Continue",
		busy = false,
		error = "",
		oncomplete
	}: {
		/** Label for the final button */
		action?: string
		busy?: boolean
		/** Shown under the final step, e.g. if saving the phrase failed */
		error?: string
		oncomplete: (phrase: string) => void
	} = $props()

	let phrase = $state("")
	let words = $derived(phrase ? phrase.split(" ") : [])
	let step: "show" | "check" = $state("show")
	let revealed = $state(false)
	let saved = $state(false)
	let copied = $state(false)
	let checks: number[] = $state([])
	let answers = $state(["", "", ""])
	let mismatch = $state(false)

	function regenerate() {
		phrase = newPhrase()
		revealed = copied = saved = false
	}
	onMount(regenerate)

	function toCheck() {
		// three different words, in order
		const picks = new Set<number>()
		while (picks.size < 3) picks.add(Math.floor(Math.random() * phraseLength))
		checks = [...picks].sort((a, b) => a - b)
		answers = ["", "", ""]
		mismatch = false
		step = "check"
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(phrase)
			copied = true
		} catch {}
	}

	function finish(e: SubmitEvent) {
		e.preventDefault()
		mismatch = checks.some((n, i) => normalise(answers[i]) !== words[n])
		if (!mismatch) oncomplete(phrase)
	}
</script>

{#if step === "show"}
	<div class="eyebrow pb-2">Your recovery phrase</div>
	<div class="phrase">
		<div class={["words", { hidden: !revealed }]} aria-hidden={!revealed}>
			{#each words as word, i}
				<div class="word">
					<span class="n">{i + 1}</span>
					<span class="mono">{word}</span>
				</div>
			{/each}
		</div>
		{#if !revealed}
			<div class="reveal">
				<button
					type="button"
					class="btn btn-secondary btn-sm"
					disabled={!phrase}
					onclick={() => (revealed = true)}>
					<fa fa-eye></fa>
					Show my phrase
				</button>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap gap-2 pt-3">
		<button
			type="button"
			class="btn btn-tertiary btn-sm"
			disabled={!revealed}
			onclick={copy}>
			<fa fa-copy></fa>
			{copied ? "Copied" : "Copy"}
		</button>
		<button type="button" class="btn btn-tertiary btn-sm" onclick={regenerate}>
			<fa fa-rotate></fa>
			Make another
		</button>
	</div>

	<ul class="notes">
		<li>Write these {phraseLength} words down, in order, and keep them somewhere safe. A password manager works too.</li>
		<li>They're the only way into your account. Anyone who has them can sign in as you, so never share them.</li>
		<li>If you lose them, only an administrator can help you make new ones.</li>
	</ul>

	<label class="check pt-4">
		<input type="checkbox" bind:checked={saved} disabled={!revealed} />
		I've written my phrase down somewhere safe
	</label>
	<button
		type="button"
		class="btn btn-primary w-full mt-5"
		disabled={!revealed || !saved}
		onclick={toCheck}>
		Continue
	</button>
{:else}
	<form onsubmit={finish}>
		<div class="eyebrow pb-2">Check your phrase</div>
		<p class="grey-text text-sm">
			Type these words from what you wrote down, to make sure it's right.
		</p>
		{#each checks as n, i}
			<label class="block pb-4">
				<span class="block pb-2">Word {n + 1}</span>
				<input
					bind:value={answers[i]}
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					class="mono"
					required />
			</label>
		{/each}
		{#if mismatch}
			<p class="text-sm text-red-400">
				That doesn't match. Go back and check what you wrote down.
			</p>
		{:else if error}
			<p class="text-sm text-red-400">{error}</p>
		{/if}
		<div class="flex gap-2 pt-2">
			<button
				type="button"
				class="btn btn-tertiary"
				disabled={busy}
				onclick={() => (step = "show")}>
				Back
			</button>
			<button class="btn btn-primary flex-1" disabled={busy}>
				{busy ? "Working..." : action}
			</button>
		</div>
	</form>
{/if}

<style>
	.phrase {
		position: relative;
	}

	.words {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		background: var(--accent2);
		border: 1px solid var(--accent2);
		&.hidden .word {
			filter: blur(6px);
			user-select: none;
		}
		@media (max-width: 400px) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.word {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0.5rem 0.625rem;
		background: var(--darker);
		& .n {
			width: 1.25rem;
			font-family: var(--font-mono);
			font-size: 0.6875rem;
			color: var(--dim-text);
			text-align: right;
		}
		& .mono {
			font-size: 0.875rem;
		}
	}

	/* centred with flex, as buttons use translate when pressed */
	.reveal {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.notes {
		margin: 1rem 0 0;
		padding-left: 1.125rem;
		font-size: 0.8125rem;
		color: var(--grey-text);
		& li + li {
			padding-top: 0.375rem;
		}
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 0.875rem;
	}
</style>
