<script lang="ts" module>
	export type UserType = {
		username: string
		permissionLevel: number
		status: "Playing" | "Online" | "Offline"
	}
</script>

<script lang="ts">
	import CommentMain from "$components/CommentMain.svelte"
	import User from "$components/User.svelte"
	import { slide } from "svelte/transition"
	import fade from "$lib/fade"
	import type { Comment } from "$lib/comment"
	import type { LikeForm } from "$lib/like2"

	// Some have to be bindable to allow them to keep state, either on element/component destroy or on page change
	let {
		likeForm,
		comment,
		depth = 0,
		num,
		// postAuthorName,
		commentsCollapsed = $bindable(),
		replyingTo = $bindable(),
		user
	}: {
		likeForm: LikeForm
		comment: Comment
		depth?: number
		num: number
		// postAuthorName: string
		commentsCollapsed: { [id: string]: boolean }
		replyingTo: string
		user: UserType
	} = $props()

	const collapse = (id: string) => () => {
		commentsCollapsed[id] = !commentsCollapsed[id]
	}
</script>

{#if comment && comment.author}
	<div class="pt-4 flex" in:fade|global={{ num }}>
		<span class="flex flex-col items-center pt-1">
			<User user={comment.author} size="1.75rem" />
			<button
				onclick={collapse(comment.id)}
				aria-label="Collapse reply"
				class={["collapseBar", { pinned: comment.pinned }]}>
			</button>
		</span>

		{#if commentsCollapsed?.[comment.id]}
			<!-- delay transition in -->
			<button
				in:fade={{ delay: 350, duration: 150 }}
				onclick={collapse(comment.id)}
				aria-label="Expand reply"
				class="expandBar pl-3 text-sm text-left max-h-10 overflow-hidden">
				<b class="light-text">{comment.author.username}</b>
				&ndash; {comment.content[0].text}
			</button>
		{:else}
			<div transition:slide class="min-w-0 flex-1 pl-3">
				<CommentMain
					{likeForm}
					{comment}
					{depth}
					bind:commentsCollapsed
					bind:replyingTo
					{user} />
			</div>
		{/if}
	</div>
{/if}

<style>
	.collapseBar {
		flex: 1;
		width: 1.75rem;
		margin-top: 0.5rem;
		padding: 0;
		background: none;
		border: 0;
		cursor: pointer;
		position: relative;
		&::before {
			content: "";
			position: absolute;
			top: 0;
			bottom: 0;
			left: 50%;
			width: 1px;
			background: var(--accent2);
			transition: background-color 0.15s;
		}
		&.pinned::before {
			background: var(--success);
		}
		&:hover::before {
			width: 2px;
			background: var(--primary);
		}
	}

	.expandBar {
		color: var(--grey-text);
		background: none;
		border: none;
		cursor: pointer;
		&:hover {
			color: var(--light-text);
		}
	}
</style>
