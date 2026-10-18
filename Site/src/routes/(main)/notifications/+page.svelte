<script lang="ts">
	import Head from "$components/Head.svelte"
	import User from "$components/User.svelte"

	const { data } = $props()

	const notificationNotes: { [_: string]: string } = {
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
	}
</script>

<Head name={data.siteName} title="Notifications" />

<div class="ctnr max-w-220">
	<div class="page-head">
		<div>
			<div class="eyebrow">You</div>
			<h1>Notifications</h1>
			<p>
				{data.notifications.length > 0
					? `${data.notifications.length} notification${data.notifications.length === 1 ? "" : "s"}. Opening this page marks them all as read.`
					: "Friend requests, replies and more will show up here."}
			</p>
		</div>
	</div>

	{#if data.notifications.length > 0}
		<div class="panel">
			{#each data.notifications as notification}
				<div class={["notification", { unread: !notification.read }]}>
					<User user={notification.sender} size="2.75rem" bg="accent" class="self-start" />
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-baseline justify-between gap-x-3">
							<b class="text-sm">
								{notificationNotes[notification.type]}
							</b>
							<time class="eyebrow normal-case tracking-normal">
								{notification.created.toLocaleString()}
							</time>
						</div>
						{#if notification.link}
							<a href={notification.link} class="light-text block pt-1 break-words">
								{notification.note}
							</a>
						{:else}
							<span class="block pt-1 break-words">{notification.note}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<b>No notifications yet</b>
		</div>
	{/if}
</div>

<style>
	.notification {
		display: flex;
		gap: 1rem;
		padding: 1rem 1.25rem;
		& + .notification {
			border-top: 1px solid var(--accent2);
		}
		&.unread {
			background: var(--primary-soft);
			box-shadow: inset 2px 0 0 var(--primary);
		}
	}
</style>
