<script lang="ts">
	import { page } from "$app/state"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"
	import { likeForm } from "../../like.remote"
	import { getCategory } from "./category.remote"
	import ForumPost from "./ForumPost.svelte"

	const { data } = $props()
	const category = getCategory(data.categoryName)
</script>

<!-- no, there is unfortunately no alternative -->
{#if true}
	{@const { name, posts, pages } = await category}
	<Head name={data.siteName} title="{name} - Forum" />

	<div class="ctnr max-w-220">
		<div class="page-head">
			<div>
				<Breadcrumbs path={[["Forum", "/forum"]]} final={name} />
				<h1>{name}</h1>
			</div>
			<a href="/forum/create?category={name}" class="btn btn-primary">
				<fa fa-file></fa>
				New post
			</a>
		</div>
		{#if posts.length > 0}
			<div class="flex flex-col gap-3">
				{#each posts as post, num (post.id)}
					<!-- Make sure to put this in an @const here, and separate it from the .enhance() call in the component property, or else ALL HELL WILL BREAK LOOSE -->
					{@const likePost = likeForm.for(post.id)}

					<ForumPost
						likeForm={likePost}
						{num}
						{post}
						total={posts.length} />
				{/each}
			</div>
			{#key page.url}
				<Pagination totalPages={pages} />
			{/key}
		{:else}
			<div class="empty">
				<b>No posts in this category yet</b>
				<p>Be the first to write one!</p>
			</div>
		{/if}
	</div>
{/if}
