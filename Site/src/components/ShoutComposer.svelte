<script lang="ts">
	// The shoutbox message box: Enter sends, Shift+Enter starts a new line,
	// :name completes emoji, and Up edits your last message

	import { tick } from "svelte"
	import type { Emoji } from "$lib/shoutbox/emoji"
	import { graphemes, maxLength } from "$lib/shoutbox/limits"
	import EmojiPicker from "./EmojiPicker.svelte"

	const {
		channel,
		disabled = "",
		onsend,
		oneditlast
	}: {
		channel: string
		/** Why the user can't post here, if they can't */
		disabled?: string
		/** Sends a message, returning an error to show if it failed */
		onsend: (text: string) => Promise<string | void>
		oneditlast: () => void
	} = $props()

	let text = $state("")
	let error = $state("")
	let sending = $state(false)
	let pickerOpen = $state(false)
	let textarea: HTMLTextAreaElement | undefined = $state()

	// emoji data is only loaded when it's first needed
	let emoji: typeof import("$lib/shoutbox/emoji") | null = $state(null)
	const loadEmoji = async () =>
		(emoji ||= await import("$lib/shoutbox/emoji"))

	let length = $derived(graphemes(text.trim()).length)

	// :partial emoji name before the cursor
	let suggestions: Emoji[] = $state([])
	let selected = $state(0)
	let partial = ""

	async function suggest() {
		if (!textarea) return
		const before = text.slice(0, textarea.selectionStart)
		const match = /(?:^|\s):([a-z0-9_+-]{2,32})$/i.exec(before)
		if (!match) {
			suggestions = []
			return
		}
		partial = match[1]
		const { search } = await loadEmoji()
		suggestions = search(partial)
		selected = 0
	}

	function insert(value: string, replace = 0) {
		if (!textarea) return
		const start = textarea.selectionStart - replace
		const end = textarea.selectionEnd
		const caret = start + value.length
		// set the box directly, so the caret is in place before the next key
		textarea.value = text = text.slice(0, start) + value + text.slice(end)
		textarea.focus()
		textarea.setSelectionRange(caret, caret)
		resize()
	}

	function closePicker() {
		pickerOpen = false
		textarea?.focus()
	}

	function complete(e: Emoji) {
		insert(e.emoji, partial.length + 1)
		suggestions = []
	}

	function resize() {
		if (!textarea) return
		textarea.style.height = "auto"
		textarea.style.height = `${Math.min(textarea.scrollHeight + 2, 160)}px`
	}

	async function send() {
		const message = text.trim()
		if (!message || sending || length > maxLength) return
		sending = true
		error = ""
		const failed = await onsend(message)
		sending = false
		if (failed) error = failed
		else {
			text = ""
			await tick()
			resize()
		}
		textarea?.focus()
	}

	function keydown(e: KeyboardEvent) {
		if (e.isComposing) return
		if (suggestions.length) {
			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault()
				const n = suggestions.length
				selected = (selected + (e.key === "ArrowDown" ? 1 : n - 1)) % n
				return
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault()
				complete(suggestions[selected])
				return
			}
			if (e.key === "Escape") {
				suggestions = []
				return
			}
		}
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			send()
		} else if (e.key === "ArrowUp" && !text) {
			e.preventDefault()
			oneditlast()
		} else if (e.key === "Escape") pickerOpen = false
	}

	async function togglePicker() {
		await loadEmoji()
		pickerOpen = !pickerOpen
	}
</script>

<svelte:window
	onclick={e => {
		if (pickerOpen && !(e.target as Element).closest(".composer"))
			pickerOpen = false
	}} />

<div class="composer">
	{#if suggestions.length}
		<ul class="suggestions" role="listbox" aria-label="Emoji">
			{#each suggestions as s, i (s.emoji)}
				<li role="option" aria-selected={i === selected}>
					<button
						type="button"
						onmousedown={e => e.preventDefault()}
						onclick={() => complete(s)}>
						<span class="emoji">{s.emoji}</span>
						<span class="mono">:{s.names[0]}:</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if pickerOpen && emoji}
		<div class="popup">
			<EmojiPicker
				categories={emoji.categories}
				onpick={(e, keepOpen) => {
					if (!keepOpen) pickerOpen = false
					insert(e)
				}}
				onclose={closePicker} />
		</div>
	{/if}

	{#if disabled}
		<p class="locked">
			<fa fa-lock></fa>
			{disabled}
		</p>
	{:else}
		<div class="row">
			<textarea
				bind:this={textarea}
				bind:value={text}
				rows="1"
				maxlength="4000"
				placeholder="Message #{channel}"
				aria-label="Message #{channel}"
				oninput={() => {
					resize()
					suggest()
					error = ""
				}}
				onclick={suggest}
				onkeydown={keydown}
				onblur={() => setTimeout(() => (suggestions = []), 150)}>
			</textarea>
			<button
				type="button"
				class="icon"
				title="Emoji"
				aria-label="Emoji"
				aria-expanded={pickerOpen}
				onclick={togglePicker}>
				<span class="smile">🙂</span>
			</button>
			<button
				type="button"
				class="icon"
				title="Formatting"
				aria-label="Formatting help"
				popovertarget="shout-formatting">
				<span class="mono text-xs font-600">Aa</span>
			</button>
			<button
				type="button"
				class="send btn btn-primary"
				disabled={sending || !text.trim() || length > maxLength}
				onclick={send}
				aria-label="Send">
				<fa fa-paper-plane-top></fa>
			</button>
		</div>
		<div class="foot">
			<span class="error" aria-live="polite">{error}</span>
			{#if length > maxLength - 100}
				<span class={["mono", { over: length > maxLength }]}>
					{length}/{maxLength}
				</span>
			{/if}
		</div>
	{/if}
</div>

<div id="shout-formatting" popover="auto" class="formatting">
	<div class="eyebrow pb-2">Formatting</div>
	<dl class="kv">
		<div><dt>**bold**</dt><dd><strong>bold</strong></dd></div>
		<div><dt>*italic* or _italic_</dt><dd><em>italic</em></dd></div>
		<div><dt>__underline__</dt><dd><u>underline</u></dd></div>
		<div><dt>~~strike~~</dt><dd><s>strike</s></dd></div>
		<div><dt>||spoiler||</dt><dd><span class="spoiler-demo">spoiler</span></dd></div>
		<div><dt>`code`</dt><dd><code>code</code></dd></div>
		<div><dt>&gt; quote</dt><dd>quote, at the start of a line</dd></div>
		<div><dt>@name</dt><dd>mention someone</dd></div>
		<div><dt>:joy:</dt><dd>😂</dd></div>
	</dl>
	<p class="grey-text text-xs pt-3 pb-0">
		Links are shown in full. Shift+Enter starts a new line, and Up edits
		your last message.
	</p>
</div>

<style>
	.composer {
		position: relative;
		padding: 0.75rem 1rem 0.375rem;
		border-top: 1px solid var(--accent2);
	}

	.row {
		display: flex;
		align-items: flex-end;
		background: var(--darker);
		border: 1px solid var(--accent2);
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		&:focus-within {
			border-color: var(--primary);
			box-shadow: 0 0 0 3px
				color-mix(in srgb, var(--primary) 25%, transparent);
		}
		& textarea {
			flex: 1;
			min-width: 0;
			max-height: 10rem;
			padding: 0.5625rem 0.75rem;
			font: inherit;
			font-size: 0.875rem;
			color: var(--light-text);
			background: transparent;
			border: 0;
			outline: none;
			resize: none;
			box-shadow: none;
		}
	}

	.icon {
		align-self: stretch;
		width: 2.375rem;
		max-height: 2.5rem;
		margin-top: auto;
		font-size: 0.9375rem;
		color: var(--grey-text);
		background: none;
		border: 0;
		cursor: pointer;
		transition: color 0.15s;
		&:hover,
		&[aria-expanded="true"] {
			color: var(--primary-text);
			& .smile {
				filter: none;
				opacity: 1;
			}
		}
		& .smile {
			filter: grayscale(1);
			opacity: 0.65;
			transition: opacity 0.15s;
		}
	}

	.send {
		align-self: stretch;
		max-height: 2.5rem;
		margin: -1px -1px -1px 0.25rem;
		padding: 0 0.875rem;
	}

	.foot {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		min-height: 1.375rem;
		padding-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		& .error {
			color: var(--danger);
		}
		& .over {
			color: var(--danger);
		}
	}

	.locked {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem 0.875rem;
		font-size: 0.8125rem;
		color: var(--grey-text);
	}

	.popup,
	.suggestions {
		position: absolute;
		bottom: calc(100% - 0.25rem);
		z-index: 5;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
	}

	.popup {
		right: 1rem;
	}

	.suggestions {
		left: 1rem;
		min-width: 14rem;
		margin: 0;
		padding: 0.25rem 0;
		list-style: none;
		background: var(--background);
		border: 1px solid var(--accent3);
		& button {
			display: flex;
			align-items: center;
			gap: 0.625rem;
			width: 100%;
			padding: 0.3rem 0.75rem;
			font-size: 0.8125rem;
			color: var(--light-text);
			text-align: left;
			background: none;
			border: 0;
			cursor: pointer;
		}
		& [aria-selected="true"] button,
		& button:hover {
			background: var(--accent2);
		}
		& .emoji {
			font-size: 1.125rem;
		}
	}

	.formatting {
		width: min(22rem, calc(100vw - 2rem));
		padding: 1rem;
		color: var(--light-text);
		background: var(--background);
		border: 1px solid var(--accent3);
		& .kv {
			border: 1px solid var(--accent2);
		}
		& .kv > div {
			padding: 0.375rem 0.75rem;
		}
		& dt {
			font-family: var(--font-mono);
			font-size: 0.75rem;
		}
		& dd {
			font-weight: 400;
		}
	}

	.spoiler-demo {
		padding: 0 0.25rem;
		background: var(--accent3);
		color: transparent;
	}
</style>
