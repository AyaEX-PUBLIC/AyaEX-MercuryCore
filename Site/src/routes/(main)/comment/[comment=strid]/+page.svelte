<script lang="ts">
	import type { ActionResult } from "@sveltejs/kit"
	import { invalidateAll } from "$app/navigation"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Comment from "$components/Comment.svelte"
	import Head from "$components/Head.svelte"
	import PostReply from "$components/PostReply.svelte"
	import { superForm } from "$lib/validate"
	import { likeForm } from "../../like.remote"
	import { getComment } from "./comment.remote"
	import ForumPost from "./ForumPost.svelte"
	import ForumReply from "./ForumReply.svelte"

	let replyingTo = $state("")
	let commentsCollapsed = $state({})

	const { data } = $props()
	let comment = $derived(getComment(data.commentId))

	let { user } = $derived(data)

	async function onResult({ result }: { result: ActionResult }) {
		if (result.type === "success") await invalidateAll()
	}
	let formData = $derived(superForm(data.form))

	const elide = (c: string) => (c.length > 50 ? `${c.slice(0, 50)}...` : c)

	function getBreadcrumb(c: Awaited<typeof comment>): [string, string][] {
		const { info, type } = c

		if (type[0] === "status") return [["Status", "/"]]
		if (!info) return []

		if (info.type === "asset")
			return [
				["Catalog", "/catalog"],
				["Asset", `/catalog/${type[1]}/${info.slug}`]
			]

		const start: [string, string][] = [
			["Forum", "/forum"],
			[
				info.category || "Category",
				`/forum/${info.category?.toLowerCase()}`
			]
		]

		if (type.length === 2) return start

		return [...start, [elide(info.post || "Post"), `/comment/${type[2]}`]]
	}
</script>

<Head name={data.siteName} title="Comment" />

{#if true}
	{@const c = await comment}
	{@const { comments, content, type, visibility } = c}
	<!-- huge padding cuz otherwise the dropdown on the bottom comments arent visible lmfao -->
	<div class={["ctnr max-w-240", { "pb-32": comments.length > 0 }]}>
		<div class="pb-4">
			<Breadcrumbs path={getBreadcrumb(c)} final={elide(content[0].text)} />
		</div>

		{#if visibility === "Deleted" || visibility === "Moderated"}
			<div class="pb-6">
				<div class="alert alert-red" role="alert">
					<fa class="pr-2" fa-eye-slash></fa>
					<b>
						This comment has been {visibility === "Deleted"
							? "deleted"
							: "removed"}.
					</b>
					{#if type[0] === "forum" && type.length === 2}
						It will no longer appear in forum category pages or in
						recent post sections.
					{/if}
				</div>
			</div>
		{/if}

		<!-- These are just different ways of displaying exactly the same information -->
		{#if type[0] === "forum"}
			{#if type.length === 2}
				<ForumPost comment={c} {likeForm} {onResult} {user} />
			{:else}
				<ForumReply comment={c} {likeForm} {onResult} {user} />
			{/if}
		{:else if type[0] === "status"}
			{#if type.length === 1}
				<ForumPost comment={c} {likeForm} {onResult} {user} />
			{:else}
				<ForumReply comment={c} {likeForm} {onResult} {user} />
			{/if}
		{/if}

		<div class="pt-6">
			<PostReply {formData} />
		</div>

		{#if comments.length > 0}
			{#each comments as c, num (c.id)}
				<Comment
					{likeForm}
					comment={c}
					{num}
					bind:commentsCollapsed
					bind:replyingTo
					{user} />
			{/each}
		{:else}
			<div class="empty mt-4">
				<b>No replies yet</b>
				<p>Be the first to post one!</p>
			</div>
		{/if}
	</div>
{/if}
