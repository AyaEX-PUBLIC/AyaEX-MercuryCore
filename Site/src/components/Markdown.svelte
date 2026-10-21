<script lang="ts">
	// A parsed Markdown text (lib/markdown.ts), drawn as elements. Nothing here is
	// raw HTML, so a post can't inject any, and the parser only lets safe URLs through.

	import type { Block, Inline } from "$lib/markdown"

	const { blocks }: { blocks: Block[] } = $props()

	const external = (href: string) => /^https?:\/\//i.test(href)
</script>

{#snippet inl(list: Inline[])}{#each list as n}{#if typeof n === "string"}{n}{:else if n.t === "strong"}<strong>{@render inl(n.c)}</strong>{:else if n.t === "em"}<em>{@render inl(n.c)}</em>{:else if n.t === "del"}<del>{@render inl(n.c)}</del>{:else if n.t === "code"}<code>{n.v}</code>{:else if n.t === "br"}<br />{:else if n.t === "link"}<a
				href={n.href}
				title={n.title}
				target={external(n.href) ? "_blank" : undefined}
				rel={external(n.href) ? "noopener noreferrer nofollow" : undefined}>{@render inl(n.c)}</a>{:else if n.t === "img"}<img
				src={n.src}
				alt={n.alt}
				title={n.title}
				loading="lazy"
				decoding="async"
				referrerpolicy="no-referrer" />{/if}{/each}{/snippet}

{#snippet body(list: Block[])}
	{#each list as b}
		{#if b.t === "p"}
			<p>{@render inl(b.c)}</p>
		{:else if b.t === "h"}
			<!-- a post's title is the page's h1, so # is a second-level heading -->
			<svelte:element this={`h${Math.min(b.level + 1, 6)}`}>
				{@render inl(b.c)}
			</svelte:element>
		{:else if b.t === "quote"}
			<blockquote>{@render body(b.c)}</blockquote>
		{:else if b.t === "list"}
			<svelte:element
				this={b.ordered ? "ol" : "ul"}
				start={b.ordered && b.start !== 1 ? b.start : undefined}>
				{#each b.items as item}
					<li class={{ task: item.checked !== undefined }}>
						{#if item.checked !== undefined}
							<input type="checkbox" checked={item.checked} disabled aria-label={item.checked ? "Done" : "Not done"} />
						{/if}
						<div>{@render body(item.c)}</div>
					</li>
				{/each}
			</svelte:element>
		{:else if b.t === "code"}
			<pre><code>{b.v}</code></pre>
		{:else if b.t === "hr"}
			<hr />
		{:else if b.t === "table"}
			<div class="scroll">
				<table>
					<thead>
						<tr>
							{#each b.head as cell, k}
								<th scope="col" style:text-align={b.align[k]}>{@render inl(cell)}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each b.rows as row}
							<tr>
								{#each row as cell, k}
									<td style:text-align={b.align[k]}>{@render inl(cell)}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/each}
{/snippet}

<div class="markdown">
	{@render body(blocks)}
</div>

<style>
	.markdown {
		font-size: 1.0625rem;
		line-height: 1.7;
		overflow-wrap: anywhere;
		color: var(--light-text);

		& > :global(:first-child) {
			margin-top: 0;
		}
		& > :global(:last-child) {
			margin-bottom: 0;
			padding-bottom: 0;
		}
	}

	p {
		margin: 0 0 1.125rem;
		padding: 0;
	}

	h2,
	h3,
	h4,
	h5,
	h6 {
		margin: 2.25rem 0 0.875rem;
		scroll-margin-top: calc(var(--header-height) + 1rem);
	}
	h2 {
		font-size: 1.625rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--accent2);
	}
	h3 {
		font-size: 1.25rem;
	}
	h4,
	h5,
	h6 {
		font-size: 1.0625rem;
	}
	h6 {
		color: var(--grey-text);
	}

	a {
		text-decoration: underline;
		text-decoration-color: var(--primary-line);
		text-underline-offset: 3px;
		&:hover {
			text-decoration-color: currentColor;
		}
	}

	strong {
		font-weight: 650;
	}

	del {
		color: var(--grey-text);
	}

	blockquote {
		margin: 0 0 1.125rem;
		padding: 0.25rem 0 0.25rem 1.125rem;
		color: var(--grey-text);
		border-left: 3px solid var(--primary-line);
		& :global(p:last-child) {
			margin-bottom: 0;
		}
	}

	ul,
	ol {
		margin: 0 0 1.125rem;
		padding-left: 1.5rem;
	}
	li {
		padding: 0.0625rem 0;
		& > div > :global(p) {
			margin-bottom: 0;
		}
		& > div > :global(* + *) {
			margin-top: 0.375rem;
		}
		& > div > :global(ul),
		& > div > :global(ol) {
			margin-bottom: 0;
		}
		&::marker {
			color: var(--dim-text);
		}
	}
	li.task {
		list-style: none;
		display: flex;
		gap: 0.625rem;
		margin-left: -1.5rem;
		& input {
			flex-shrink: 0;
			margin-top: 0.5rem;
		}
	}

	pre {
		margin: 0 0 1.25rem;
		padding: 1rem 1.125rem;
		overflow-x: auto;
		font-size: 0.875rem;
		line-height: 1.55;
		background: var(--darker);
		border: 1px solid var(--accent2);
		& code {
			padding: 0;
			color: var(--light-text);
			background: none;
			border: 0;
			font-size: inherit;
			overflow-wrap: normal;
		}
	}

	hr {
		margin: 2.25rem 0;
	}

	img {
		display: block;
		max-width: 100%;
		height: auto;
		margin: 1.5rem 0;
		border: 1px solid var(--accent2);
	}

	.scroll {
		margin: 0 0 1.25rem;
		overflow-x: auto;
		& table {
			width: 100%;
			font-size: 0.9375rem;
		}
	}
</style>
