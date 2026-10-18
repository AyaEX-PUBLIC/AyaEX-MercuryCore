<script lang="ts">
	import CommentLike from "$components/CommentLike.svelte"
	import PinButton from "$components/PinButton.svelte"
	import ReportButton from "$components/ReportButton.svelte"
	import User from "$components/User.svelte"
	import type { LikeForm } from "$lib/like2"
	import type { getComment } from "./comment.remote"

	let {
		comment,
		likeForm,
		onResult,
		user
	}: {
		comment: Awaited<ReturnType<typeof getComment>>["comments"][number]
		likeForm: Omit<LikeForm, "for">
		onResult: (result: {
			result: import("@sveltejs/kit").ActionResult
		}) => Promise<void>
		user: import("./$types").PageData["user"]
	} = $props()

	const refreshComments = () => onResult
</script>

<a href="/comment/{comment.parentId}" class="inline-flex items-center gap-2 text-sm pb-3">
	<fa fa-arrow-up></fa>
	Parent comment
</a>

<div class={["reply", { pinned: comment.pinned }]}>
	<div class="flex items-center gap-3 pb-3">
		<User user={comment.author} full size="2rem" />
		<time class="eyebrow normal-case tracking-normal ml-auto">
			{comment.created.toLocaleString()}
		</time>
	</div>
	<p class="break-words whitespace-pre-line">
		{comment.content[0].text}
	</p>

	<div class="flex items-center gap-2 -ml-1.5">
		<CommentLike {comment} {likeForm} small />

		<span class="dropdown">
			<fa fa-ellipsis-h class="dropdown-ellipsis"></fa>
			<div class="dropdown-content">
				<ul>
					{#if user.permissionLevel >= 4}
						<PinButton
							{refreshComments}
							id={comment.id}
							pinned={comment.pinned} />
					{/if}
					<ReportButton
						user={comment.author.username}
						url="/comment/{comment.id}" />
				</ul>
			</div>
		</span>
	</div>
</div>

<style>
	.reply {
		padding: 1.25rem;
		background: var(--background);
		border: 1px solid var(--accent2);
		&.pinned {
			border-left: 2px solid var(--success);
		}
	}
</style>
