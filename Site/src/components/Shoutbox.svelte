<script lang="ts">
	// The shoutbox on the home page: chat channels with live updates.
	// Messages arrive from /api/shoutbox/stream (server-sent events) for every
	// channel at once, so other channels can show unread counts.

	import { onMount, tick, untrack } from "svelte"
	import { replaceState } from "$app/navigation"
	import { editWindow } from "$lib/shoutbox/limits"
	import { canModerate, canWrite } from "$lib/shoutbox/permissions"
	import {
		deleteShout,
		editShout,
		sendShout
	} from "$lib/shoutbox/shoutbox.remote"
	import type { Channel, Shout } from "$lib/shoutbox/types"
	import ShoutComposer from "./ShoutComposer.svelte"
	import ShoutMessage from "./ShoutMessage.svelte"

	type Event =
		| { type: "new" | "edit"; channel: string; shout: Shout }
		| { type: "delete"; channel: string; id: string }
		| { type: "channels" }

	const {
		user,
		initial
	}: {
		user: { username: string; permissionLevel: number }
		initial: {
			channels: Channel[]
			channel: string
			messages: Shout[]
			cursor: string
			pageSize: number
		}
	} = $props()

	// the page keys this component by channel, so only the first props matter
	const start = untrack(() => initial)
	const { pageSize } = start

	// most messages kept per channel; older ones are loaded again on scroll
	const keep = 300
	const groupGap = 5 * 60e3

	let channels = $state(start.channels)
	let active = $state(start.channel)
	let logs: {
		[channel: string]: { messages: Shout[]; more: boolean }
	} = $state({
		[start.channel]: {
			messages: start.messages,
			more: start.messages.length >= pageSize
		}
	})
	let unread: { [channel: string]: { count: number; mention: boolean } } =
		$state({})
	let status: "connecting" | "live" | "offline" = $state("connecting")
	let mounted = $state(false)
	let loading = $state(false)
	let loadError = $state("")
	let editing = $state("")
	let atBottom = $state(true)
	let missed = $state(0)
	let log: HTMLElement | undefined = $state()

	let channel = $derived(channels.find(c => c.id === active))
	let current = $derived(logs[active])
	let writable = $derived(!!channel && canWrite(channel, user.permissionLevel))
	const posters = [
		"",
		"",
		"verified users and above",
		"catalog managers and above",
		"moderators and administrators",
		"administrators"
	]
	let lockReason = $derived(
		!channel || writable
			? ""
			: `Only ${posters[Math.max(channel.readLevel, channel.writeLevel)]} can post in #${channel.name}`
	)

	// day dividers and grouping, once times can be shown in the viewer's zone
	let items = $derived.by(() => {
		const list: (
			| { key: string; day: string }
			| { key: string; shout: Shout; grouped: boolean }
		)[] = []
		let previous: Shout | undefined
		for (const shout of current?.messages || []) {
			const day = new Date(shout.created).toDateString()
			const newDay =
				!previous || new Date(previous.created).toDateString() !== day
			if (mounted && newDay) list.push({ key: `day-${day}`, day })
			list.push({
				key: shout.id,
				shout,
				// (days depend on the time zone, so they only count once mounted)
				grouped:
					!(mounted && newDay) &&
					!!previous &&
					previous.author.username === shout.author.username &&
					shout.created - previous.created < groupGap
			})
			previous = shout
		}
		return list
	})

	function dayName(day: string) {
		const date = new Date(day)
		const today = new Date()
		const yesterday = new Date(Date.now() - 864e5)
		if (date.toDateString() === today.toDateString()) return "Today"
		if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
		return date.toLocaleDateString(undefined, {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: date.getFullYear() === today.getFullYear() ? undefined : "numeric"
		})
	}

	// When each channel was last read, so unread messages can be marked
	const seenKey = "shoutboxSeen"
	let seen: { [channel: string]: number } = {}
	function markSeen() {
		const last = current?.messages.at(-1)?.created || channel?.last
		if (!last || !atBottom || document.hidden) return
		unread[active] = { count: 0, mention: false }
		if ((seen[active] || 0) >= last) return
		seen[active] = last
		try {
			localStorage.setItem(seenKey, JSON.stringify(seen))
		} catch {}
	}

	const errorText = (e: unknown) =>
		(e as { body?: { message?: string } })?.body?.message ||
		"Something went wrong, try again"

	async function fetchJson<T>(url: string): Promise<T> {
		const res = await fetch(url)
		if (!res.ok) throw new Error((await res.json().catch(() => null))?.message)
		return res.json()
	}

	async function load(id: string, before?: number) {
		const params = new URLSearchParams({ channel: id })
		if (before) params.set("before", before.toString())
		return fetchJson<Shout[]>(`/api/shoutbox/history?${params}`)
	}

	async function scrollToBottom() {
		await tick()
		if (log) log.scrollTop = log.scrollHeight
		atBottom = true
		missed = 0
		markSeen()
	}

	async function switchTo(id: string) {
		if (id === active && current) return
		active = id
		editing = ""
		loadError = ""
		replaceState(`?channel=${id}`, {})
		if (!logs[id]) {
			loading = true
			try {
				const messages = await load(id)
				logs[id] = { messages, more: messages.length >= pageSize }
			} catch (e) {
				loadError = (e as Error).message || "Couldn't load messages"
			}
			loading = false
		}
		await scrollToBottom()
	}

	async function loadOlder() {
		const entry = logs[active]
		if (!entry?.more || loading || !log) return
		loading = true
		const id = active
		const height = log.scrollHeight
		try {
			const older = await load(id, entry.messages[0]?.created)
			const known = new Set(entry.messages.map(m => m.id))
			entry.messages = [...older.filter(m => !known.has(m.id)), ...entry.messages]
			entry.more = older.length >= pageSize
			await tick()
			if (active === id) log.scrollTop += log.scrollHeight - height
		} catch (e) {
			loadError = (e as Error).message || "Couldn't load messages"
		}
		loading = false
	}

	function add(shout: Shout) {
		const entry = logs[shout.channel]
		const c = channels.find(c => c.id === shout.channel)
		if (c && shout.created >= (c.last || 0)) {
			c.last = shout.created
			c.lastBy = shout.author.username
		}
		if (!entry || entry.messages.some(m => m.id === shout.id)) return false
		entry.messages.push(shout)
		if (entry.messages.length > keep) {
			entry.messages.splice(0, entry.messages.length - keep)
			entry.more = true
		}
		return true
	}

	async function handle(event: Event) {
		if (event.type === "channels") return reloadChannels()
		const entry = logs[event.channel]

		if (event.type === "delete") {
			if (entry) entry.messages = entry.messages.filter(m => m.id !== event.id)
			if (editing === event.id) editing = ""
			return
		}
		if (event.type === "edit") {
			const i = entry?.messages.findIndex(m => m.id === event.shout.id) ?? -1
			if (entry && i !== -1) entry.messages[i] = event.shout
			return
		}

		const shout = event.shout
		const fresh = add(shout) || !entry
		if (!fresh || shout.author.username === user.username) {
			if (shout.channel === active) scrollToBottom()
			return
		}
		const mention = new RegExp(
			`(^|[^A-Za-z0-9_])@${user.username}(?![A-Za-z0-9_])`,
			"i"
		).test(shout.body)
		if (shout.channel === active && !document.hidden) {
			if (atBottom) return scrollToBottom()
			missed++
			return
		}
		const u = unread[shout.channel] || { count: 0, mention: false }
		unread[shout.channel] = { count: u.count + 1, mention: u.mention || mention }
	}

	async function reloadChannels() {
		try {
			const data = await fetchJson<{ channels: Channel[] }>("/api/shoutbox")
			channels = data.channels
			if (!channels.some(c => c.id === active) && channels[0])
				await switchTo(channels[0].id)
		} catch {}
	}

	// after a stream reset: reload the channels and the open channel, and
	// forget the others until they're opened again
	async function reloadAll() {
		await reloadChannels()
		try {
			const messages = await load(active)
			for (const id of Object.keys(logs)) if (id !== active) delete logs[id]
			logs[active] = { messages, more: messages.length >= pageSize }
			if (atBottom) await scrollToBottom()
		} catch {}
	}

	// Live updates. EventSource reconnects by itself after network errors;
	// if the server refuses it (e.g. too many tabs), try again a bit later.
	let source: EventSource | null = null
	let cursor = start.cursor
	let retry = 0
	let retryTimer: ReturnType<typeof setTimeout>
	let hiddenTimer: ReturnType<typeof setTimeout>

	function connect() {
		clearTimeout(retryTimer)
		source?.close()
		status = "connecting"
		const s = new EventSource(
			`/api/shoutbox/stream?after=${encodeURIComponent(cursor)}`
		)
		source = s
		s.onopen = () => {
			status = "live"
			retry = 0
		}
		s.onmessage = e => {
			if (e.lastEventId) cursor = e.lastEventId
			try {
				handle(JSON.parse(e.data))
			} catch (err) {
				console.error("Shoutbox event failed:", err)
			}
		}
		s.addEventListener("reset", e => {
			cursor = (e as MessageEvent).lastEventId || cursor
			reloadAll()
		})
		s.onerror = () => {
			if (s.readyState !== EventSource.CLOSED) {
				status = "connecting"
				return
			}
			status = "offline"
			retryTimer = setTimeout(connect, Math.min(60e3, 5e3 * 2 ** retry++))
		}
	}

	function disconnect() {
		clearTimeout(retryTimer)
		source?.close()
		source = null
		status = "offline"
	}

	// close the stream in tabs left in the background, as browsers only allow
	// a few connections to a site at once
	function visibility() {
		clearTimeout(hiddenTimer)
		if (document.hidden) hiddenTimer = setTimeout(disconnect, 60e3)
		else {
			if (!source) connect()
			markSeen()
		}
	}

	onMount(() => {
		mounted = true
		try {
			seen = JSON.parse(localStorage.getItem(seenKey) || "{}") || {}
		} catch {}
		// (your own message isn't news to you, even from another device)
		for (const c of channels)
			if (
				c.id !== active &&
				c.last &&
				c.last > (seen[c.id] || 0) &&
				c.lastBy !== user.username
			)
				unread[c.id] = { count: 0, mention: false }
		scrollToBottom()
		connect()
		document.addEventListener("visibilitychange", visibility)
		return () => {
			disconnect()
			clearTimeout(hiddenTimer)
			document.removeEventListener("visibilitychange", visibility)
		}
	})

	function scrolled() {
		if (!log) return
		atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40
		if (atBottom) {
			missed = 0
			markSeen()
		}
		if (log.scrollTop < 120) loadOlder()
	}

	async function send(body: string) {
		try {
			const shout = await sendShout({ channel: active, body })
			add(shout)
			await scrollToBottom()
		} catch (e) {
			return errorText(e)
		}
	}

	async function save(id: string, body: string) {
		try {
			const shout = await editShout({ id, body })
			const entry = logs[shout.channel]
			const i = entry?.messages.findIndex(m => m.id === id) ?? -1
			if (entry && i !== -1) entry.messages[i] = shout
			editing = ""
		} catch (e) {
			return errorText(e)
		}
	}

	async function remove(id: string) {
		try {
			await deleteShout({ id })
			const entry = logs[active]
			if (entry) entry.messages = entry.messages.filter(m => m.id !== id)
		} catch (e) {
			loadError = errorText(e)
		}
	}

	const editable = (shout: Shout) =>
		shout.author.username === user.username &&
		writable &&
		Date.now() - shout.created < editWindow

	function editLast() {
		const last = current?.messages.findLast(editable)
		if (last) editing = last.id
	}

	// not scanned by unocss otherwise
	const _uno = ["fa-lock", "fa-bullhorn"]
</script>

<section class="panel shoutbox" aria-label="Shoutbox">
	<div class="panel-head">
		<span>Shoutbox</span>
		<span class={["live", status]} title={status === "live" ? "Messages appear as they're sent" : ""}>
			<span class="dot"></span>
			{status === "live" ? "Live" : status === "connecting" ? "Connecting" : "Offline"}
		</span>
	</div>

	{#if channels.length > 1}
		<div class="channels" role="tablist" aria-label="Channels">
			{#each channels as c (c.id)}
				{@const u = unread[c.id]}
				<button
					type="button"
					role="tab"
					aria-selected={c.id === active}
					class={{ unread: u && c.id !== active, mention: u?.mention && c.id !== active }}
					title={c.description}
					onclick={() => switchTo(c.id)}>
					{#if c.readLevel > 1 || c.writeLevel > 1}
						<fa class={c.readLevel > 1 ? "fa-lock" : "fa-bullhorn"}></fa>
					{:else}
						<span class="hash">#</span>
					{/if}
					{c.name}
					{#if u && c.id !== active}
						<span class="count" title="New messages">
							{u.count ? (u.count > 99 ? "99+" : u.count) : "new"}
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if channel?.description || channel?.slowmode}
		<div class="topic">
			<span class="truncate">
				<b>#{channel.name}</b>
				{#if channel.description}&middot; {channel.description}{/if}
			</span>
			{#if channel.slowmode}
				<span class="badge shrink-0" title="One message every {channel.slowmode} seconds">
					Slow mode &middot; {channel.slowmode}s
				</span>
			{/if}
		</div>
	{/if}

	<div
		class="log"
		bind:this={log}
		onscroll={scrolled}
		role="log"
		aria-live="polite"
		aria-label="Messages in #{channel?.name}">
		{#if current?.more}
			<div class="older">
				<button type="button" class="btn btn-sm btn-tertiary" onclick={loadOlder} disabled={loading}>
					{loading ? "Loading..." : "Load older messages"}
				</button>
			</div>
		{:else if current && current.messages.length > 0}
			<div class="start">This is the start of #{channel?.name}</div>
		{/if}

		{#each items as item (item.key)}
			{#if "day" in item}
				<div class="day eyebrow" role="separator">{dayName(item.day)}</div>
			{:else}
				<ShoutMessage
					shout={item.shout}
					me={user.username}
					grouped={item.grouped}
					{mounted}
					canEdit={mounted && editable(item.shout)}
					canDelete={item.shout.author.username === user.username ||
						canModerate(item.shout.author.level, user.permissionLevel)}
					editing={editing === item.shout.id}
					onedit={() => (editing = item.shout.id)}
					onsave={body => save(item.shout.id, body)}
					oncancel={() => (editing = "")}
					ondelete={() => remove(item.shout.id)} />
			{/if}
		{:else}
			<div class="empty m-4">
				{#if loading}
					<p>Loading messages...</p>
				{:else}
					<b>No messages yet</b>
					<p>Say hi to get #{channel?.name || "the shoutbox"} started!</p>
				{/if}
			</div>
		{/each}
	</div>

	{#if missed > 0 && !atBottom}
		<button type="button" class="jump" onclick={scrollToBottom}>
			{missed} new {missed === 1 ? "message" : "messages"}
			<fa fa-arrow-down></fa>
		</button>
	{/if}
	{#if loadError}
		<p class="load-error">{loadError}</p>
	{/if}

	{#if channel}
		<ShoutComposer
			channel={channel.name}
			disabled={lockReason}
			onsend={send}
			oneditlast={editLast} />
	{/if}
</section>

<style>
	.shoutbox {
		position: relative;
	}

	.live {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		& .dot {
			width: 0.4375rem;
			height: 0.4375rem;
			background: var(--warning);
		}
		&.live .dot {
			background: var(--success);
			box-shadow: 0 0 0 3px var(--success-line);
		}
		&.offline .dot {
			background: var(--danger);
		}
	}

	.channels {
		display: flex;
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--accent2);
		& button {
			display: inline-flex;
			flex-shrink: 0;
			align-items: center;
			gap: 0.4rem;
			padding: 0.625rem 0.875rem;
			font: inherit;
			font-size: 0.8125rem;
			font-weight: 500;
			color: var(--grey-text);
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			margin-bottom: -1px;
			cursor: pointer;
			transition:
				color 0.15s,
				background-color 0.15s;
			& + button {
				border-left: 1px solid var(--accent2);
			}
			& fa,
			& .hash {
				font-size: 0.6875rem;
				color: var(--dim-text);
			}
			& .hash {
				font-family: var(--font-mono);
				font-size: 0.8125rem;
			}
			&:hover {
				color: var(--light-text);
				background: var(--accent);
			}
			&[aria-selected="true"] {
				color: var(--light-text);
				border-bottom-color: var(--primary);
				& fa,
				& .hash {
					color: var(--primary-text);
				}
			}
			&.unread {
				color: var(--light-text);
			}
		}
		& .count {
			padding: 0 0.3rem;
			font-family: var(--font-mono);
			font-size: 0.625rem;
			font-weight: 500;
			line-height: 0.875rem;
			letter-spacing: 0.04em;
			text-transform: uppercase;
			color: var(--primary-text);
			background: var(--primary-soft);
			border: 1px solid var(--primary-line);
		}
		& .mention .count {
			color: #fff;
			background: var(--primary);
			border-color: var(--primary);
		}
	}

	.topic {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		color: var(--grey-text);
		border-bottom: 1px solid var(--accent2);
		& b {
			color: var(--light-text);
			font-weight: 600;
		}
	}

	.log {
		height: clamp(22rem, 62vh, 36rem);
		padding: 0.75rem 0 0.5rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		scroll-behavior: auto;
	}

	.older,
	.start {
		display: flex;
		justify-content: center;
		padding: 0.25rem 1rem 0.75rem;
	}

	.start {
		gap: 0.5rem;
		align-items: center;
		font-size: 0.75rem;
		color: var(--dim-text);
	}

	.day {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem 0.25rem;
		font-size: 0.625rem;
		color: var(--dim-text);
		&::before,
		&::after {
			content: "";
			flex: 1;
			height: 1px;
			background: var(--accent2);
		}
	}

	.jump {
		position: absolute;
		left: 50%;
		bottom: 5.25rem;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.875rem;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		color: #fff;
		background: var(--primary);
		border: 0;
		translate: -50% 0;
		cursor: pointer;
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
		&:hover {
			background: var(--primary-hover);
		}
	}

	.load-error {
		padding: 0.5rem 1rem 0;
		font-size: 0.75rem;
		color: var(--danger);
	}
</style>
