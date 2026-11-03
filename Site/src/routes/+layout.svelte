<script lang="ts">
	import nprogress from "nprogress"
	import { onMount } from "svelte"
	import { enhance } from "$app/forms"
	import { navigating } from "$app/state"
	import User from "$components/User.svelte"

	import "/src/nprogress.css"
	import "/src/global.css"
	import "/src/icons.css"
	import "/src/daisyui/dropdown.css"
	import "/src/daisyui/tooltip.css"
	import "uno.css"

	const { data, children } = $props()

	let user = $derived(data.user)

	// Settings for nprogress, the loading bar shown at the top of the page when navigating
	nprogress.configure({ showSpinner: false })

	let timeout: Timer | null
	const stopTimeout = () => {
		if (!timeout) return
		clearTimeout(timeout)
		timeout = null
	}
	// 100ms is the minimum time the loading bar will be shown
	$effect(async () => {
		if (!navigating || navigating.willUnload == null) return
		stopTimeout()
		if (navigating.type === "goto") {
			// TODO: hack to prevent redirects from showing the bar
			nprogress.done()
			return
		}

		timeout = setTimeout(nprogress.start, 100)
		await navigating.complete
		stopTimeout()
		nprogress.done()
	})

	async function ping() {
		// Keep the user's online status up to date
		if (!user) return

		// Save to localStorage so we don't ping multiple times if the user has multiple tabs open
		const lastPing = localStorage.getItem("lastPing")
		if (lastPing && Date.now() - +lastPing < 30e3) return
		await fetch("/api?/statusping", {
			method: "post",
			body: new FormData()
		})
		localStorage.setItem("lastPing", Date.now().toString())
	}
	onMount(() => setInterval(ping, 30e3))

	const notificationNotes: { [_: string]: string } = Object.freeze({
		AssetApproved: "Asset approval",
		FriendRequest: "Friend request",
		GroupInvite: "Group invite",
		Follower: "New follower",
		ForumPostReply: "Reply to your post",
		ForumReplyReply: "Reply to your reply",
		AssetComment: "Comment on your asset",
		AssetCommentReply: "Reply to your comment",
		ForumMention: "Mention",
		ForumPost: "New forum post",
		ItemPurchase: "Item purchased",
		Message: "New message",
		NewFriend: "New friend"
	})

	let notifications = $derived(data.notifications.filter(n => !n.read))
	// only the newest few; the rest are a click away
	const maxToasts = 3
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="theme-color" content="#18181a" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="icon" href="/assets/favicon" />
	<link
		rel="preload"
		href="/fonts/Geist-latin.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous" />

	<!-- todo: document analytics setup -->
	<!-- {#if !dev}
		<script
			defer
			data-domain={data.domain}
			src="https://analytics.{data.domain}/js/script.js"></script>
	{/if} -->
</svelte:head>

<!-- Toast notifications -->
{#if notifications.length > 0}
	<div class="toasts">
		{#each notifications.slice(0, maxToasts) as notification (notification.id)}
			<div
				class="toast"
				role="alert"
				aria-live="assertive"
				aria-atomic="true">
				<div class="flex items-center gap-3 px-3 pt-3">
					<a
						href="/user/{notification.sender.username}"
						class="light-text flex gap-3 items-center min-w-0 flex-1">
						<User
							user={notification.sender}
							size="1.75rem"
							bg="accent"
							image />
						<span class="min-w-0">
							<b class="block text-sm truncate">
								{notificationNotes[notification.type]}
							</b>
							<small class="eyebrow block normal-case tracking-normal">
								{notification.created.toLocaleString()}
							</small>
						</span>
					</a>
					<form
						use:enhance
						method="post"
						action="/notifications?s={notification.id}">
						<button
							class="btn btn-quatenary btn-sm px-2"
							aria-label="Dismiss">
							<fa fa-xmark-large></fa>
						</button>
					</form>
				</div>
				<a
					href={notification.link}
					class="light-text block px-3 pt-2 pb-3 text-sm">
					{notification.note}
				</a>
			</div>
		{/each}
		{#if data.unreadCount > maxToasts}
			<a href="/notifications" class="toast more">
				{data.unreadCount - maxToasts} more unread
				<fa fa-arrow-right></fa>
			</a>
		{/if}
	</div>
{/if}

{@render children()}

<style>
	.toasts {
		position: fixed;
		right: 0;
		bottom: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: min(100%, 24rem);
		padding: 1rem;
	}

	.toast {
		background: var(--background);
		border: 1px solid var(--accent2);
		border-left: 2px solid var(--primary);
		box-shadow: 0 1rem 2rem -0.75rem rgb(0 0 0 / 0.7);
		&.more {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.5rem 0.75rem;
			font-size: 0.8125rem;
			color: var(--grey-text);
			border-left-color: var(--accent3);
			&:hover {
				color: var(--light-text);
			}
		}
	}
</style>
