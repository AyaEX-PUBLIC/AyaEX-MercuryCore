<script lang="ts">
	// User profile link component: a square headshot, optionally with the username

	import type { ClassValue } from "svelte/elements"

	const statusLabels = Object.freeze({
		Playing: "Playing",
		Online: "Online",
		Offline: ""
	})
	const hoverBackgrounds = Object.freeze({
		darker: "background",
		background: "accent",
		accent: "accent1",
		accent1: "accent2",
		accent2: "accent3",
		accent3: "accent2"
	})

	const {
		user,
		full = false,
		thin = false,
		image = false,
		bottom = false,
		rerender = null,
		size = "2rem",
		bg = "accent",
		class: class_ = ""
	}: {
		user: BasicUser
		full?: boolean
		thin?: boolean
		image?: boolean
		bottom?: boolean
		rerender?: {
			form?: {
				avatar?: string
			} | null
			regenerating?: boolean
		} | null // Used on profile page for rerender button
		size?: string
		bg?: keyof typeof hoverBackgrounds
		class?: ClassValue
	} = $props()

	let src = $derived(
		rerender?.form?.avatar || `/api/avatar/${user.username}`
	)
	let status = $derived(statusLabels[user.status] || "")
</script>

{#snippet avatar()}
	<span
		class={["pfp", { faded: rerender?.regenerating }]}
		style="--size: {size}; --bg: var(--{bg}); --hover: var(--{hoverBackgrounds[bg]})">
		<img {src} alt={user.username} loading="lazy" />
		{#if status}
			<span
				class={["status", user.status]}
				title={status}
				aria-label={status}>
			</span>
		{/if}
	</span>
{/snippet}

{#if image}
	<div class={["flex", class_, { "items-center": full }]}>
		{@render avatar()}
		{#if full}
			<span class={thin ? "pl-2 text-sm" : "pl-3 font-semibold"}>
				{user.username}
			</span>
		{/if}
	</div>
{:else}
	<a
		href="/user/{user.username}"
		class={[
			"user flex light-text",
			class_,
			{
				"flex-col": bottom,
				"items-center": full
			}
		]}>
		{@render avatar()}
		{#if full}
			<span class={thin ? "pl-2 text-sm" : "pl-3 font-semibold"}>
				{user.username}
			</span>
		{:else if bottom}
			<span
				class={[
					"name pt-2 text-center text-sm truncate",
					{ "text-xs": user.username?.length > 15 }
				]}
				style="max-width: {size}">
				{user.username}
			</span>
		{/if}
	</a>
{/if}

<style>
	.pfp {
		position: relative;
		display: block;
		flex-shrink: 0;
		align-self: center; /* stretching would undo the aspect ratio */
		width: var(--size);
		aspect-ratio: 1;
		background: var(--bg);
		border: 1px solid var(--accent2);
		transition:
			background-color 0.15s,
			border-color 0.15s,
			opacity 0.3s;
		&.faded {
			opacity: 0.5;
		}
		& img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.user:hover .pfp {
		background: var(--hover);
		border-color: var(--accent3);
	}

	.user:hover .name {
		color: var(--grey-text);
	}

	.status {
		position: absolute;
		right: -1px;
		bottom: -1px;
		width: clamp(0.375rem, 18%, 0.875rem);
		aspect-ratio: 1;
		border: 2px solid var(--background);
		box-sizing: content-box;
		&.Playing {
			background: var(--success);
		}
		&.Online {
			background: #38bdf8;
		}
	}
</style>
