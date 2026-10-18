<script lang="ts">
	import Head from "$components/Head.svelte"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"

	const { data } = $props()

	let { user } = $derived(data)
</script>

<Head name={data.siteName} title="Forum" />

<div class="ctnr max-w-280">
	<div class="page-head">
		<div>
			<div class="eyebrow">Community</div>
			<h1>Forum</h1>
		</div>
		{#if user.permissionLevel === 5}
			<a href="/forum/create/category" class="btn btn-tertiary">
				<fa fa-plus></fa>
				New category
			</a>
		{/if}
	</div>
	{#if data.categories.length > 0}
		<div class="panel">
			{#each data.categories as category, num}
				<div
					in:fade|global={{ num, total: data.categories.length }}
					class="category">
					<a
						class="light-text min-w-0 flex-1"
						href="/forum/{category.name.toLowerCase()}">
						<h2 class="text-base">{category.name}</h2>
						<span class="grey-text text-sm">{category.description}</span>
					</a>
					<span class="eyebrow shrink-0 w-24">
						{category.postCount || "No"} post{category.postCount == 1 ? "" : "s"}
					</span>
					<div class="latest">
						{#if category.latestPost}
							{@const content = category.latestPost.currentContent}
							<a href="/comment/{category.latestPost.id}" class="light-text text-sm block truncate">
								{content.slice(0, 40)}{content.length > 40 ? "..." : ""}
							</a>
							<span class="flex items-center gap-2 pt-1 text-xs grey-text">
								by
								<User user={category.latestPost.author} full thin size="1.25rem" />
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<b>There are no categories in the forum yet</b>
			{#if user.permissionLevel === 5}
				<p>Why not <a href="/forum/create/category">create one</a>?</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.category {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1rem 1.25rem;
		& + .category {
			border-top: 1px solid var(--accent2);
		}
		@media (max-width: 767.9px) {
			flex-wrap: wrap;
			gap: 0.5rem 1.5rem;
		}
	}

	.latest {
		width: 16rem;
		min-width: 0;
		@media (max-width: 767.9px) {
			width: 100%;
		}
	}
</style>
