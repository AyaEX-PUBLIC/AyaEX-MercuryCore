<script lang="ts">
	import CommentLike from "$components/CommentLike.svelte"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"
	import type { LikeForm } from "$lib/like2"
	import type { getCategory } from "./category.remote"

	const {
		likeForm,
		num,
		post,
		total
	}: {
		likeForm: Omit<LikeForm, "for">
		num: number
		post: Awaited<ReturnType<typeof getCategory>>["posts"][number]
		total: number
	} = $props()

	let hidden = $derived(post.visibility !== "Visible")
</script>

<div
	in:fade|global={{ num, total }}
	class={["post", { pinned: post.pinned }]}>
	<CommentLike
		class={["votes", { "opacity-33": hidden }]}
		{likeForm}
		comment={post} />
	<div class={["flex flex-col min-w-0 flex-1 p-4", { "opacity-33": hidden }]}>
		<div class="flex justify-between items-center gap-3">
			<User user={post.author} full thin size="1.5rem" />
			<time class="eyebrow normal-case tracking-normal">
				{post.created.toLocaleString()}
			</time>
		</div>
		<a href="/comment/{post.id}" class="light-text content">
			{post.currentContent}
		</a>
	</div>
</div>

<style>
	.post {
		display: flex;
		max-height: 11rem;
		overflow: hidden;
		background: var(--background);
		border: 1px solid var(--accent2);
		transition: border-color 0.15s;
		&:hover {
			border-color: var(--accent3);
		}
		&.pinned {
			border-left: 2px solid var(--success);
		}
		& :global(.votes) {
			background: var(--darker);
			border-right: 1px solid var(--accent2);
		}
	}

	.content {
		display: block;
		padding-top: 0.75rem;
		overflow: hidden;
		overflow-wrap: anywhere;
		white-space: pre-line;
		mask-image: linear-gradient(black 60%, transparent);
	}
</style>
