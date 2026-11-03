<script lang="ts">
	// One shoutbox message. Messages right after another by the same person
	// are "grouped", without the avatar and name. A reply shows the start of
	// the message it's to above it, and reactions go below it.

	import permissionLevels from "$lib/permissionLevels"
	import { maxReactions } from "$lib/shoutbox/limits"
	import type { Reaction, Shout } from "$lib/shoutbox/types"
	import ShoutText from "./ShoutText.svelte"

	const {
		shout,
		me,
		grouped = false,
		mounted = true,
		canEdit = false,
		canDelete = false,
		canReply = false,
		canReact = false,
		editing = false,
		flash = false,
		onedit,
		onsave,
		oncancel,
		ondelete,
		onreply,
		onreact,
		onpickreaction,
		onjump
	}: {
		shout: Shout
		me: string
		grouped?: boolean
		/** Times are only shown once mounted, in the viewer's time zone */
		mounted?: boolean
		canEdit?: boolean
		canDelete?: boolean
		canReply?: boolean
		canReact?: boolean
		editing?: boolean
		/** Highlights the message for a moment, after jumping to it */
		flash?: boolean
		onedit?: () => void
		/** Saves an edit, returning an error to show if it failed */
		onsave?: (body: string) => Promise<string | void>
		oncancel?: () => void
		ondelete?: () => void
		onreply?: () => void
		/** Adds or removes your reaction */
		onreact?: (emoji: string, add: boolean) => void
		/** Opens the emoji picker by a button, to react with a new emoji */
		onpickreaction?: (button: HTMLElement) => void
		/** Scrolls to a message, returning false if it isn't loaded */
		onjump?: (id: string) => boolean
	} = $props()

	// not scanned by unocss otherwise
	const _uno = ["fa-check", "fa-hammer", "fa-shield-alt", "fa-scale-balanced"]

	let { username, level } = $derived(shout.author)
	let role = $derived(level > 1 ? permissionLevels(level) : null)
	let mine = $derived(username === me)
	let reply = $derived(shout.replyTo)
	let mentioned = $derived(
		!mine &&
			!!me &&
			((reply && !reply.deleted && reply.author === me) ||
				new RegExp(`(^|[^A-Za-z0-9_])@${me}(?![A-Za-z0-9_])`, "i").test(
					shout.body
				))
	)
	let roomToReact = $derived(shout.reactions.length < maxReactions)

	function who({ emoji, users }: Reaction) {
		const shown = users.slice(0, 10).map(u => (u === me ? "You" : u))
		const others = users.length - shown.length
		const names =
			shown.length > 1
				? `${shown.slice(0, -1).join(", ")} and ${others ? `${shown.at(-1)}, ${others} more` : shown.at(-1)}`
				: shown[0]
		return `${names} reacted with ${emoji}`
	}

	function jump(e: MouseEvent) {
		if (reply && onjump?.(reply.id)) e.preventDefault()
	}

	const pick = (e: MouseEvent) =>
		onpickreaction?.(e.currentTarget as HTMLElement)

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

{#snippet replyIcon()}
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<path d="M6.5 3.5 2.5 7.5l4 4" />
		<path d="M2.5 7.5h7a4 4 0 0 1 4 4v1" />
	</svg>
{/snippet}

<!-- focusable so that tapping a message shows its time and actions on touch screens -->
<article class={["msg", { grouped, mentioned, flash }]} id="shout-{shout.id}" tabindex="-1">
	{#if reply}
		<div class="reply">
			<span class="spine"></span>
			{#if reply.deleted}
				<span class="gone">Original message was deleted</span>
			{:else}
				<a href="/shout/{reply.id}" class="quoted" title="Go to the message" onclick={jump}>
					<img src="/api/avatar/{reply.author}" alt="" loading="lazy" />
					<b>@{reply.author}</b>
					<ShoutText body={reply.body} {me} preview />
				</a>
			{/if}
		</div>
	{/if}

	<div class="row">
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

			{#if shout.reactions.length}
				<div class="reactions">
					{#each shout.reactions as r (r.emoji)}
						{@const reacted = r.users.includes(me)}
						{#if canReact}
							<button
								type="button"
								class={{ reacted }}
								aria-pressed={reacted}
								title={who(r)}
								onclick={() => onreact?.(r.emoji, !reacted)}>
								<span class="emoji">{r.emoji}</span>
								<span class="n">{r.users.length}</span>
							</button>
						{:else}
							<span class={["chip", { reacted }]} title={who(r)}>
								<span class="emoji">{r.emoji}</span>
								<span class="n">{r.users.length}</span>
							</span>
						{/if}
					{/each}
					{#if canReact && roomToReact}
						<button type="button" class="add" title="Add a reaction" aria-label="Add a reaction" onclick={pick}>
							<span class="smile">🙂</span>
							<span class="n">+</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if !editing}
		<div class="actions">
			{#if canReact && roomToReact}
				<button type="button" title="Add a reaction" aria-label="Add a reaction" onclick={pick}>
					<span class="smile">🙂</span>
				</button>
			{/if}
			{#if canReply}
				<button type="button" title="Reply" aria-label="Reply" onclick={onreply}>
					{@render replyIcon()}
				</button>
			{/if}
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
			& .side,
			& .add {
				visibility: visible;
			}
		}
		&.mentioned {
			background: var(--primary-soft);
			box-shadow: inset 2px 0 0 var(--primary);
		}
		&.flash {
			animation: flash 1.6s ease-out;
		}
		&:focus {
			outline: none;
		}
	}

	@keyframes flash {
		from {
			background: color-mix(in srgb, var(--primary) 28%, transparent);
		}
	}

	.row {
		display: flex;
		gap: 0.75rem;
	}

	/* the message replied to, joined to the avatar by a line */
	.reply {
		position: relative;
		display: flex;
		align-items: center;
		min-width: 0;
		height: 1.25rem;
		margin-bottom: 0.125rem;
		padding-left: 3rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		& .spine {
			position: absolute;
			top: 0.625rem;
			left: 1.125rem;
			width: 1.5rem;
			height: 0.875rem;
			border-top: 1px solid var(--accent3);
			border-left: 1px solid var(--accent3);
		}
		& .gone {
			font-style: italic;
			color: var(--dim-text);
		}
	}

	.quoted {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		color: inherit;
		& img {
			flex-shrink: 0;
			width: 1rem;
			height: 1rem;
			object-fit: cover;
			background: var(--accent);
		}
		& b {
			flex-shrink: 0;
			font-weight: 600;
			color: var(--light-text);
		}
		& :global(.text) {
			min-width: 0;
		}
		&:hover {
			color: var(--light-text);
		}
	}

	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.25rem 0 0.125rem;
		& button,
		& .chip {
			display: inline-flex;
			align-items: center;
			gap: 0.3125rem;
			height: 1.5rem;
			padding: 0 0.4375rem;
			font: inherit;
			color: var(--grey-text);
			background: var(--accent);
			border: 1px solid var(--accent2);
			transition:
				color 0.1s,
				border-color 0.1s;
		}
		& button {
			cursor: pointer;
			&:hover {
				color: var(--light-text);
				border-color: var(--accent3);
			}
		}
		& .reacted {
			color: var(--primary-text);
			background: var(--primary-soft);
			border-color: var(--primary-line);
			&:hover {
				color: var(--primary-text);
				border-color: var(--primary);
			}
		}
		& .emoji {
			font-size: 0.875rem;
			line-height: 1;
		}
		& .n {
			font-family: var(--font-mono);
			font-size: 0.6875rem;
		}
		/* shown with the actions */
		& .add {
			visibility: hidden;
		}
	}

	.smile {
		font-size: 0.8125rem;
		line-height: 1;
		filter: grayscale(1);
		opacity: 0.7;
		transition: opacity 0.1s;
		:hover > & {
			filter: none;
			opacity: 1;
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
		& svg {
			width: 0.8125rem;
			height: 0.8125rem;
			fill: none;
			stroke: currentColor;
			stroke-width: 1.6;
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
