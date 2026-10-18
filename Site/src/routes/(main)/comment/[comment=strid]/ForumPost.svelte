<script lang="ts">
	import CommentLike from "$components/CommentLike.svelte"
	import DeleteButton from "$components/DeleteButton.svelte"
	import PinButton from "$components/PinButton.svelte"
	import ReportButton from "$components/ReportButton.svelte"
	import User from "$components/User.svelte"
	import type { LikeForm } from "$lib/like2"
	import type { getComment } from "./comment.remote"

	const {
		comment,
		likeForm,
		onResult,
		user
	}: {
		comment: Awaited<ReturnType<typeof getComment>>
		likeForm: Omit<LikeForm, "for">
		onResult: (result: {
			result: import("@sveltejs/kit").ActionResult
		}) => Promise<void>
		user: import("./$types").PageData["user"]
	} = $props()

	const refreshComments = () => onResult
</script>

<div class={["post", { pinned: comment.pinned }]}>
	<CommentLike class="votes" {comment} {likeForm} />
	<div class="p-5 min-w-0 flex-1">
		<div class="flex items-center gap-3 pb-4">
			<User user={comment.author} full size="2rem" />
			<time class="eyebrow normal-case tracking-normal ml-auto">
				{comment.created.toLocaleString()}
			</time>
			<span class="dropdown">
				<fa fa-ellipsis-h class="dropdown-ellipsis"></fa>
				<div class="dropdown-content">
					<ul>
						{#if comment.author.username === user.username}
							<DeleteButton id={comment.id} />
						{:else}
							<ReportButton
								user={comment.author.username}
								url="/comment/{comment.id}" />
							{#if user.permissionLevel >= 4}
								<DeleteButton id={comment.id} moderate />
							{/if}
						{/if}
						{#if user.permissionLevel >= 4 && (comment.type.length !== 1 || comment.type[0] !== "status")}
							<PinButton
								id={comment.id}
								{refreshComments}
								pinned={comment.pinned} />
						{/if}
					</ul>
				</div>
			</span>
		</div>
		<p class="text-lg break-words whitespace-pre-line p-0">
			{comment.content[0].text}
		</p>
	</div>
</div>

<style>
	.post {
		display: flex;
		background: var(--background);
		border: 1px solid var(--accent2);
		&.pinned {
			border-left: 2px solid var(--success);
		}
		& :global(.votes) {
			background: var(--darker);
			border-right: 1px solid var(--accent2);
		}
	}
</style>
