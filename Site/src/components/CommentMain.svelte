<script lang="ts">
	import { enhance } from "$app/forms"
	import type { UserType } from "$components/Comment.svelte"
	import Comment from "$components/Comment.svelte"
	import DeleteButton from "$components/DeleteButton.svelte"
	import PinButton from "$components/PinButton.svelte"
	import ReportButton from "$components/ReportButton.svelte"
	import type { Comment as CommentType } from "$lib/comment"
	import type { LikeForm } from "$lib/like2"
	import { refreshComments } from "$lib/refreshComments"
	import CommentLike from "./CommentLike.svelte"

	let {
		likeForm,
		comment,
		depth = 0,
		// postAuthorName,
		commentsCollapsed = $bindable(),
		replyingTo = $bindable(),
		user
	}: {
		likeForm: LikeForm
		comment: CommentType
		depth?: number
		// postAuthorName: string
		commentsCollapsed: { [id: string]: boolean }
		replyingTo: string
		user: UserType
	} = $props()

	const likeFormFor = likeForm.for(comment.id)

	let content = $state("") // Allows current reply to not be lost on clicking to another reply

	let hidden = $derived(comment.visibility !== "Visible")
</script>

<div class="w-full">
	<div class="flex items-baseline gap-3 flex-wrap">
		<a
			href="/user/{comment.author.username}"
			class={["userlink text-sm font-600", { "opacity-33": hidden }]}>
			{comment.author.username}
		</a>
		<small class="eyebrow normal-case tracking-normal">
			{comment.created.toLocaleString()}
		</small>
	</div>
	<p
		class={[
			"py-1.5 m-0 break-words whitespace-pre-line",
			{ "opacity-33": hidden }
		]}>
		{comment.content[0].text}
	</p>
	{#if replyingTo !== comment.id}
		<div class="flex items-center gap-1 -ml-1.5">
			<CommentLike
				class={{ "opacity-33": hidden }}
				likeForm={likeFormFor}
				{comment}
				small />
			{#if !hidden}
				<a
					href="/comment/{comment.id}"
					onclick={e => {
						e.preventDefault()
						replyingTo = comment.id
					}}
					class="btn btn-sm btn-quatenary">
					<fa fa-message></fa>
					Reply
				</a>
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
							{#if user.permissionLevel >= 4}
								<PinButton
									id={comment.id}
									{refreshComments}
									pinned={comment.pinned} />
							{/if}
							<li>
								<a class="light-text" href="/comment/{comment.id}">
									<fa fa-link></fa>
									Link
								</a>
							</li>
						</ul>
					</div>
				</span>
			{/if}
		</div>
	{:else}
		<div class="panel p-4 mt-2 max-w-160">
			<form
				use:enhance={e => {
					replyingTo = ""
					return refreshComments()
				}}
				method="post"
				action="/comment/{comment.id}?/comment">
				<label for="content" class="block pb-2">
					Reply to {comment.author.username}
				</label>
				<fieldset class="flex flex-col gap-3">
					<textarea
						bind:value={content}
						required
						minlength="1"
						maxlength="1000"
						name="content"
						placeholder="What are your thoughts?"
						rows="4">
					</textarea>
					<div class="flex gap-2">
						<button class="btn btn-sm btn-primary">
							<fa fa-message></fa>
							Reply
						</button>
						<button
							type="button"
							onclick={() => {
								replyingTo = ""
							}}
							class="btn btn-sm btn-tertiary">
							Cancel
						</button>
					</div>
				</fieldset>
			</form>
		</div>
	{/if}
</div>

{#if depth > 8}
	<a href="/comment/{comment.id}" class="inline-flex items-center gap-2 text-sm py-2">
		<fa fa-arrow-down></fa>
		More comments
	</a>
{/if}

{#each comment.comments as c, num (c.id)}
	<!-- Get READY for some RECURSION!!! -->
	<Comment
		comment={c}
		{likeForm}
		depth={depth + 1}
		{num}
		bind:commentsCollapsed
		bind:replyingTo
		{user} />
{/each}

<style>
	.userlink {
		color: var(--light-text);
		&:hover {
			color: var(--grey-text);
		}
	}
</style>
