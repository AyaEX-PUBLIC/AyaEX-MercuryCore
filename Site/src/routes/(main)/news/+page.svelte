<script lang="ts">
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"
	import User from "$components/User.svelte"
	import { encode } from "$lib/urlName"

	const { data } = $props()

	// UTC, so the server and the browser agree on the day
	const date = (d: Date) =>
		d.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
			timeZone: "UTC"
		})

	// the newest post leads the first page
	let lead = $derived(data.page === 1 ? data.posts[0] : undefined)
	let rest = $derived(data.page === 1 ? data.posts.slice(1) : data.posts)
</script>

{#snippet cover(post: (typeof data.posts)[number], lazy = true)}
	{#if post.cover}
		<img
			src="/news/cover/{post.id}?v={post.updated.getTime()}"
			alt=""
			loading={lazy ? "lazy" : "eager"}
			decoding="async" />
	{:else}
		<div class="plain" aria-hidden="true"><fa fa-bullhorn></fa></div>
	{/if}
{/snippet}

<Head
	name={data.siteName}
	title="News"
	description="News and announcements from {data.siteName}." />

<div class="ctnr">
	<header class="masthead">
		<h1 class="nameplate">The {data.siteName} News</h1>
		<p class="dateline">
			<span>Today's News</span>
			<time>{data.today}</time>
		</p>
	</header>

	{#if data.posts.length === 0}
		<div class="empty">
			<fa fa-bullhorn class="text-2xl pb-2"></fa>
			<strong>No news yet</strong>
			<p>Announcements about the project will appear here.</p>
		</div>
	{:else}
		{#if lead}
			<a
				class="lead panel"
				href="/news/{lead.id}/{encode(lead.title)}">
				<div class="frame">{@render cover(lead, false)}</div>
				<div class="text">
					<div class="eyebrow">Top story &middot; {date(lead.published)}</div>
					<h2>{lead.title}</h2>
					{#if lead.excerpt}<p class="excerpt">{lead.excerpt}</p>{/if}
					<div class="byline">
						<User user={lead.author} image full thin size="1.5rem" />
						<span class="read">Read the story <fa fa-arrow-right></fa></span>
					</div>
				</div>
			</a>
		{/if}

		{#if rest.length > 0}
			<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3">
				{#each rest as post}
					<a class="story" href="/news/{post.id}/{encode(post.title)}">
						<div class="frame">{@render cover(post)}</div>
						<div class="text">
							<div class="eyebrow">{date(post.published)}</div>
							<h3>{post.title}</h3>
							{#if post.excerpt}<p class="excerpt">{post.excerpt}</p>{/if}
							<div class="byline">
								<User user={post.author} image full thin size="1.5rem" />
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<Pagination totalPages={data.pages} />
	{/if}
</div>

<style>
	@font-face {
		font-family: UnifrakturCook;
		font-style: normal;
		font-weight: 700;
		font-display: swap;
		src: url(/fonts/UnifrakturCook-latin-700.woff2) format("woff2");
	}

	.masthead {
		margin-bottom: 2rem;
		padding: 1.25rem 0 1rem;
		text-align: center;
		border-top: 3px solid var(--primary);
		border-bottom: 1px solid var(--accent2);
	}

	.nameplate {
		font-family: UnifrakturCook, "Old English Text MT", Georgia, serif;
		font-size: clamp(2.5rem, 8vw, 4.75rem);
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0;
		overflow-wrap: anywhere;
	}

	.dateline {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		margin: 1rem 0 0;
		padding: 0.5rem 0 0;
		border-top: 1px solid var(--accent2);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--grey-text);
		& span {
			color: var(--primary-text);
		}
	}

	/* the picture, or a newsprint-like block where a post has none */
	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--accent1);
		& img {
			display: block;
			width: 100%;
			height: 100%;
			object-fit: cover;
			transition: transform 0.3s;
		}
	}
	.plain {
		display: grid;
		place-items: center;
		height: 100%;
		font-size: 2.5rem;
		color: var(--accent3);
		background: repeating-linear-gradient(
			135deg,
			var(--accent) 0 0.75rem,
			var(--accent1) 0.75rem 1.5rem
		);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
		& h2,
		& h3 {
			transition: color 0.15s;
		}
		& .excerpt {
			margin: 0;
			padding: 0;
			color: var(--grey-text);
			overflow-wrap: anywhere;
		}
	}

	.byline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: auto;
		padding-top: 0.75rem;
		color: var(--grey-text);
	}

	a.lead,
	a.story {
		color: var(--light-text);
		&:hover {
			color: var(--light-text);
			& h2,
			& h3 {
				color: var(--primary-text);
			}
			& .frame img {
				transform: scale(1.03);
			}
		}
	}

	.lead {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin-bottom: 2rem;
		& .frame {
			border-bottom: 1px solid var(--accent2);
		}
		& .text {
			padding: 1.25rem 1.5rem 1.5rem;
		}
		& h2 {
			font-size: clamp(1.5rem, 3.5vw, 2.25rem);
			line-height: 1.15;
		}
		& .excerpt {
			font-size: 1.0625rem;
			line-height: 1.6;
		}
		@media (min-width: 1024px) {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
			& .frame {
				aspect-ratio: auto;
				min-height: 18rem;
				border-bottom: 0;
				border-right: 1px solid var(--accent2);
			}
			& .text {
				justify-content: center;
				padding: 2rem;
			}
		}
	}
	.read {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--primary-text);
	}

	.story {
		display: flex;
		flex-direction: column;
		& .frame {
			border-bottom: 1px solid var(--accent2);
		}
		& .text {
			flex: 1;
			padding: 1rem 1.25rem 1.25rem;
		}
		& h3 {
			font-size: 1.25rem;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
		& .excerpt {
			font-size: 0.9375rem;
			display: -webkit-box;
			-webkit-line-clamp: 3;
			line-clamp: 3;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
	}
</style>
