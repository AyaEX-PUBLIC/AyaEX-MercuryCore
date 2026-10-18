<script lang="ts">
	// One shoutbox message. Messages right after another by the same person
	// are "grouped", without the avatar and name.

	import permissionLevels from "$lib/permissionLevels"
	import type { Shout } from "$lib/shoutbox/types"
	import ShoutText from "./ShoutText.svelte"

	const {
		shout,
		me,
		grouped = false,
		mounted = true,
		canEdit = false,
		canDelete = false,
		editing = false,
		onedit,
		onsave,
		oncancel,
		ondelete
	}: {
		shout: Shout
		me: string
		grouped?: boolean
		/** Times are only shown once mounted, in the viewer's time zone */
		mounted?: boolean
		canEdit?: boolean
		canDelete?: boolean
		editing?: boolean
		onedit?: () => void
		/** Saves an edit, returning an error to show if it failed */
		onsave?: (body: string) => Promise<string | void>
		oncancel?: () => void
		ondelete?: () => void
	} = $props()

	// not scanned by unocss otherwise
	const _uno = ["fa-check", "fa-hammer", "fa-shield-alt", "fa-scale-balanced"]

	let { username, level } = $derived(shout.author)
	let role = $derived(level > 1 ? permissionLevels(level) : null)
	let mine = $derived(username === me)
	let mentioned = $derived(
		!mine &&
			!!me &&
			new RegExp(`(^|[^A-Za-z0-9_])@${me}(?![A-Za-z0-9_])`, "i").test(
				shout.body
			)
	)

	let date = $derived(new Date(shout.created))
	let time = $derived(
		mounted
			? date.toLocaleTimeString(undefined, {
					hour: "2-digit",
					minute: "2-digit"
				})
			: ""
	)
	let full = $derived(mounted ? date.toLocaleString() : "")

	let draft = $state("")
	let saving = $state(false)
	let editError = $state("")
	let confirming = $state(false)
	let confirmTimer: ReturnType<typeof setTimeout>

	$effect(() => {
		if (!editing) return
		draft = shout.body
		editError = ""
	})

	async function save() {
		if (!onsave || saving) return
		saving = true
		editError = (await onsave(draft.trim())) || ""
		saving = false
	}

	function editKey(e: KeyboardEvent) {
		if (e.isComposing) return
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			save()
		} else if (e.key === "Escape") oncancel?.()
	}

	function remove(e: MouseEvent) {
		// shift-click deletes straight away
		if (confirming || e.shiftKey) {
			clearTimeout(confirmTimer)
			ondelete?.()
			return
		}
		confirming = true
		confirmTimer = setTimeout(() => (confirming = false), 3000)
	}

	const focus = (node: HTMLTextAreaElement) => {
		node.focus()
		node.setSelectionRange(node.value.length, node.value.length)
	}

	let reportUrl = $derived(
		`/report?user=${encodeURIComponent(username)}&url=${encodeURIComponent(`/shout/${shout.id}`)}`
	)
</script>

<!-- focusable so that tapping a message shows its time and actions on touch screens -->
<article class={["msg", { grouped, mentioned }]} id="shout-{shout.id}" tabindex="-1">
	{#if grouped}
		<time class="side tnum" datetime={date.toISOString()} title={full}>
			{time}
		</time>
	{:else}
		<a href="/user/{username}" class="pfp" aria-label={username}>
			<img src="/api/avatar/{username}" alt="" loading="lazy" />
		</a>
	{/if}

	<div class="main">
		{#if !grouped}
			<div class="head">
				<a href="/user/{username}" class="name light-text">
					{username}
				</a>
				{#if role}
					<fa
						class={role[1]}
						style="color: {role[0]}"
						title={role[2]}
						aria-label={role[2]}>
					</fa>
				{/if}
				<time class="tnum" datetime={date.toISOString()} title={full}>
					{time}
				</time>
			</div>
		{/if}

		{#if editing}
			<textarea
				class="edit"
				bind:value={draft}
				maxlength="4000"
				rows="2"
				aria-label="Edit message"
				onkeydown={editKey}
				{@attach focus}>
			</textarea>
			<div class="edit-help">
				{#if editError}
					<span class="error">{editError}</span>
				{:else}
					Enter to <button type="button" onclick={save}>save</button>
					&middot; Esc to
					<button type="button" onclick={oncancel}>cancel</button>
				{/if}
			</div>
		{:else}
			<ShoutText body={shout.body} {me} />
			{#if shout.edited}
				<span class="edited" title={mounted ? new Date(shout.edited).toLocaleString() : ""}>
					(edited)
				</span>
			{/if}
		{/if}
	</div>

	{#if !editing}
		<div class="actions">
			{#if canEdit}
				<button type="button" title="Edit" aria-label="Edit" onclick={onedit}>
					<fa fa-pencil></fa>
				</button>
			{/if}
			{#if canDelete}
				<button
					type="button"
					class={["danger", { confirming }]}
					title={confirming ? "Click again to delete" : "Delete (shift-click to skip confirming)"}
					aria-label="Delete"
					onclick={remove}>
					<fa fa-trash></fa>
					{#if confirming}<span>Delete?</span>{/if}
				</button>
			{/if}
			{#if !mine}
				<a href={reportUrl} title="Report" aria-label="Report">
					<fa fa-flag></fa>
				</a>
			{/if}
			<a href="/shout/{shout.id}" title="Link to this message" aria-label="Link to this message">
				<fa fa-link></fa>
			</a>
		</div>
	{/if}
</article>

<style>
	.msg {
		position: relative;
		display: flex;
		gap: 0.75rem;
		padding: 0.5rem 1rem 0.25rem;
		transition: background-color 0.1s;
		&.grouped {
			padding-top: 0.0625rem;
		}
		&:hover,
		&:focus-within {
			background: var(--accent);
			& .actions {
				opacity: 1;
				pointer-events: auto;
			}
			& .side {
				visibility: visible;
			}
		}
		&.mentioned {
			background: var(--primary-soft);
			box-shadow: inset 2px 0 0 var(--primary);
		}
		&:focus {
			outline: none;
		}
	}

	.pfp,
	.side {
		flex-shrink: 0;
		width: 2.25rem;
	}

	.pfp {
		height: 2.25rem;
		margin-top: 0.125rem;
		background: var(--accent);
		border: 1px solid var(--accent2);
		& img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.side {
		visibility: hidden;
		padding-top: 0.2rem;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		line-height: 1.45rem;
		color: var(--dim-text);
		text-align: right;
		white-space: nowrap;
	}

	.main {
		flex: 1;
		min-width: 0;
		font-size: 0.875rem;
		color: var(--light-text);
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		min-width: 0;
		& .name {
			font-weight: 600;
			font-size: 0.875rem;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		& fa {
			font-size: 0.6875rem;
		}
		& time {
			font-family: var(--font-mono);
			font-size: 0.6875rem;
			color: var(--dim-text);
			white-space: nowrap;
		}
	}

	.edited {
		font-size: 0.6875rem;
		color: var(--dim-text);
	}

	.edit {
		margin-top: 0.25rem;
		font-size: 0.875rem;
		resize: vertical;
	}

	.edit-help {
		padding: 0.25rem 0 0.375rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		& button {
			padding: 0;
			font: inherit;
			color: var(--primary-text);
			background: none;
			border: 0;
			cursor: pointer;
		}
		& .error {
			color: var(--danger);
		}
	}

	.actions {
		position: absolute;
		top: -0.75rem;
		right: 1rem;
		display: flex;
		background: var(--background);
		border: 1px solid var(--accent2);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.1s;
		& button,
		& a {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			height: 1.625rem;
			padding: 0 0.5rem;
			font-size: 0.6875rem;
			color: var(--grey-text);
			background: none;
			border: 0;
			cursor: pointer;
			&:hover {
				color: var(--light-text);
				background: var(--accent2);
			}
		}
		& .danger:hover,
		& .confirming {
			color: var(--danger);
		}
		& .confirming {
			font-family: var(--font-mono);
		}
	}
</style>
