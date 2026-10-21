<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import Markdown from "$components/Markdown.svelte"
	import User from "$components/User.svelte"
	import { encode } from "$lib/urlName"

	const { data } = $props()

	let { post } = $derived(data)

	// UTC, so the server and the browser agree on the day
	const date = (d: Date) =>
		d.toLocaleDateString("en-US", {
			weekday: "long",
			month: "long",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC"
		})
	const short = (d: Date) =>
		d.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC"
		})

	// edited more than a day after it came out
	let edited = $derived(
		!!post.published &&
			post.updated.getTime() - post.published.getTime() > 24 * 60 * 60 * 1000
	)
</script>

<Head
	name={data.siteName}
	title={post.title}
	description={post.excerpt}
	ogImage={post.cover ? `/news/cover/${post.id}` : ""} />

<div class="ctnr">
	<div class="page">
		<Breadcrumbs path={[["News", "/news"]]} final={post.title} />

		{#if !data.live}
			<div class="alert notice" role="status">
				<fa fa-eye></fa>
				{#if post.published}
					Scheduled for {date(post.published)}. Only administrators can see it until then.
				{:else}
					Draft. Only administrators can see it.
				{/if}
			</div>
		{/if}

		<article>
			<header>
				<div class="eyebrow">
					{#if post.published}{date(post.published)}{:else}Not published{/if}
				</div>
				<h1>{post.title}</h1>
				<div class="byline">
					<User user={post.author} full thin size="1.75rem" />
					{#if edited}<span class="dim-text">Updated {short(post.updated)}</span>{/if}
					{#if data.canEdit}
						<a href="/admin/news?edit={post.id}" class="btn btn-sm btn-tertiary ml-auto">
							<fa fa-pencil></fa>
							Edit
						</a>
					{/if}
				</div>
			</header>

			{#if post.cover}
				<img class="cover" src="/news/cover/{post.id}?v={post.updated.getTime()}" alt="" />
			{/if}

			<Markdown blocks={post.blocks} />
		</article>

		{#if data.more.length > 0}
			<section class="more" aria-label="More news">
				<div class="eyebrow pb-3">More news</div>
				<div class="tiles grid sm:grid-cols-3">
					{#each data.more as other}
						<a class="other" href="/news/{other.id}/{encode(other.title)}">
							<div class="eyebrow">{short(other.published)}</div>
							<h3>{other.title}</h3>
						</a>
					{/each}
				</div>
				<p class="pt-4">
					<a href="/news"><fa fa-arrow-left></fa> All news</a>
				</p>
			</section>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 48rem;
		margin: 0 auto;
	}

	.notice {
		margin-top: 1rem;
	}

	header {
		padding: 1.25rem 0 1.5rem;
		& h1 {
			padding-top: 0.5rem;
			font-size: clamp(1.75rem, 5vw, 2.5rem);
			line-height: 1.12;
		}
	}

	.byline {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--accent2);
		font-size: 0.875rem;
	}

	.cover {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		margin: 0 0 2rem;
		border: 1px solid var(--accent2);
	}

	article {
		padding-bottom: 2rem;
	}

	.more {
		margin-top: 1rem;
		padding-top: 2rem;
		border-top: 1px solid var(--accent2);
	}

	.other {
		display: block;
		padding: 1rem 1.125rem;
		color: var(--light-text);
		& h3 {
			padding-top: 0.25rem;
			font-size: 1rem;
			transition: color 0.15s;
		}
		&:hover h3 {
			color: var(--primary-text);
		}
	}
</style>
