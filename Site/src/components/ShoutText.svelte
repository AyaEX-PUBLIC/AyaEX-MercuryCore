<script lang="ts">
	// A shoutbox message's text, with its markdown (lib/shoutbox/markdown.ts)
	// rendered as elements. Nothing here is raw HTML, so messages can't inject any.

	import parse, { type Node } from "$lib/shoutbox/markdown"

	const { body, me = "" }: { body: string; me?: string } = $props()

	let blocks = $derived(parse(body))
	let myName = $derived(me.toLowerCase())

	function reveal(e: Event) {
		const spoiler = e.currentTarget as HTMLElement
		if (spoiler.classList.contains("shown")) return
		e.preventDefault()
		spoiler.classList.add("shown")
		spoiler.removeAttribute("tabindex")
		spoiler.removeAttribute("role")
	}

	const revealKey = (e: KeyboardEvent) =>
		(e.key === "Enter" || e.key === " ") && reveal(e)
</script>

<!-- whitespace in this snippet would show, since lines keep their breaks -->
{#snippet nodes(list: Node[])}{#each list as node}{#if typeof node === "string"}{node}{:else if node.t === "b"}<strong>{@render nodes(node.c)}</strong>{:else if node.t === "i"}<em>{@render nodes(node.c)}</em>{:else if node.t === "u"}<u>{@render nodes(node.c)}</u>{:else if node.t === "s"}<s>{@render nodes(node.c)}</s>{:else if node.t === "spoiler"}<span class="spoiler" role="button" tabindex="0" title="Spoiler" onclick={reveal} onkeydown={revealKey}>{@render nodes(node.c)}</span>{:else if node.t === "code"}<code>{node.v}</code>{:else if node.t === "link"}<a href={node.href} target="_blank" rel="noopener noreferrer nofollow ugc" class="link">{node.v}</a>{:else if node.t === "mention"}<a href="/user/{node.v}" class={["mention", { me: node.v.toLowerCase() === myName }]}>@{node.v}</a>{/if}{/each}{/snippet}

<span class="text">{#each blocks as block}{#if block.quote}<span class="quote">{@render nodes(block.c)}</span>{:else}<span class="lines">{@render nodes(block.c)}</span>{/if}{/each}</span>

<style>
	.text {
		display: block;
		white-space: pre-line;
		overflow-wrap: anywhere;
		/* anything taller than a line (e.g. stacked accents) stays inside it */
		overflow: hidden;
		overflow: clip;
		line-height: 1.45;
	}

	.lines,
	.quote {
		display: block;
	}

	.quote {
		margin: 0.125rem 0;
		padding-left: 0.625rem;
		color: var(--grey-text);
		border-left: 2px solid var(--accent3);
	}

	strong {
		font-weight: 650;
	}

	code {
		font-size: 0.8125em;
		white-space: pre-wrap;
	}

	.link {
		text-decoration: underline;
		text-decoration-color: var(--primary-line);
		text-underline-offset: 2px;
		word-break: break-all;
	}

	.mention {
		padding: 0 0.125rem;
		color: var(--primary-text);
		background: var(--primary-soft);
		&.me {
			color: var(--light-text);
			background: color-mix(in srgb, var(--primary) 45%, transparent);
		}
	}

	.spoiler {
		background: var(--accent3);
		transition:
			color 0.15s,
			background-color 0.15s;
		&:not(:global(.shown)) {
			color: transparent;
			cursor: pointer;
			user-select: none;
			& :global(*) {
				color: transparent !important;
				background: transparent !important;
				border-color: transparent !important;
				pointer-events: none;
			}
		}
		&:not(:global(.shown)):hover {
			background: var(--grey-text);
			background: color-mix(in srgb, var(--accent3) 70%, var(--grey-text));
		}
		&:global(.shown) {
			background: var(--accent1);
		}
	}
</style>
