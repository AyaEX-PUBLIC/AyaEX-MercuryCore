<script lang="ts">
	// A box for typing or pasting a recovery phrase, checking the words as
	// they're typed

	import { isWord, normalise, phraseLength, validPhrase } from "$lib/phrase"

	let {
		phrase = $bindable(""),
		label = "Recovery phrase",
		id = "phrase",
		autofocus = false
	}: {
		phrase?: string
		label?: string
		id?: string
		autofocus?: boolean
	} = $props()

	let words = $derived(normalise(phrase).split(" ").filter(Boolean))
	// the last word might still be being typed
	let typing = $derived(!/\s$/.test(phrase) && words.length < phraseLength)
	let unknown = $derived(
		words.filter((w, i) => !isWord(w) && !(typing && i === words.length - 1))
	)
	let valid = $derived(words.length === phraseLength && validPhrase(phrase))

	let status = $derived.by(() => {
		if (!words.length) return ["", ""]
		if (unknown.length)
			return ["bad", `"${unknown[0]}" isn't a phrase word. Check the spelling.`]
		if (words.length > phraseLength)
			return ["bad", `That's more than ${phraseLength} words`]
		if (words.length < phraseLength) return ["", ""]
		if (!valid)
			return ["bad", "These words don't make a valid phrase. Check for a typo or a swapped word."]
		return ["good", "Phrase looks right"]
	})

	const focus = (node: HTMLTextAreaElement) => {
		if (autofocus) node.focus()
	}
</script>

<div class="entry">
	<label for={id}>{label}</label>
	<textarea
		{id}
		bind:value={phrase}
		rows="3"
		autocomplete="off"
		autocapitalize="none"
		spellcheck="false"
		placeholder="{phraseLength} words, separated by spaces"
		{@attach focus}></textarea>
	<div class="status">
		<span class="mono tnum">{Math.min(words.length, 99)}/{phraseLength} words</span>
		<span class={status[0]} aria-live="polite">{status[1]}</span>
	</div>
</div>

<style>
	.entry {
		padding-bottom: 1.25rem;
		& label {
			display: block;
			padding-bottom: 0.5rem;
		}
		& textarea {
			font-family: var(--font-mono);
			font-size: 0.875rem;
			resize: none;
		}
	}

	.status {
		display: flex;
		gap: 0.75rem;
		padding-top: 0.375rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		& .mono {
			flex-shrink: 0;
		}
		& .bad {
			color: var(--danger);
		}
		& .good {
			color: var(--success);
		}
	}
</style>
