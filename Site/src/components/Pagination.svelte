<script lang="ts">
	import { page } from "$app/state"

	const { totalPages }: { totalPages: number } = $props()

	function getNewUrl(p: number) {
		const url = new URL(page.url) // clone?
		url.searchParams.set("p", p.toString())
		return url.pathname + url.search
	}
	const pageQ = page.url.searchParams.get("p") || "1"
	const currentPage = Number.isNaN(+pageQ) ? 1 : +pageQ
	const prevPage = currentPage - 1
	const nextPage = currentPage + 1

	// 1, …, current, …, last (0 is a gap)
	let pages = $derived.by(() => {
		const pages = [1]
		if (currentPage > 2) pages.push(0)
		if (currentPage !== 1 && currentPage !== totalPages)
			pages.push(currentPage)
		if (currentPage + 1 < totalPages) pages.push(0)
		if (totalPages > 1) pages.push(totalPages)
		return pages
	})
</script>

{#if totalPages > 1}
	<nav class="pagination" aria-label="pagination">
		<a
			href={getNewUrl(prevPage)}
			class={{ disabled: prevPage < 1 }}
			aria-label="Previous page">
			<fa fa-arrow-left></fa>
		</a>
		{#each pages as p}
			{#if p}
				<a
					href={getNewUrl(p)}
					aria-current={p === currentPage ? "page" : undefined}>
					{p}
				</a>
			{:else}
				<span>…</span>
			{/if}
		{/each}
		<a
			href={getNewUrl(nextPage)}
			class={{ disabled: nextPage > totalPages }}
			aria-label="Next page">
			<fa fa-arrow-right></fa>
		</a>
	</nav>
{/if}

<style>
	.pagination {
		display: flex;
		justify-content: center;
		padding-top: 2rem;
		& > * {
			display: grid;
			place-items: center;
			min-width: 2.25rem;
			height: 2.25rem;
			padding: 0 0.5rem;
			font-family: var(--font-mono);
			font-size: 0.8125rem;
			color: var(--grey-text);
			border: 1px solid var(--accent2);
			& + * {
				margin-left: -1px;
			}
		}
		& a:hover {
			color: var(--light-text);
			background: var(--accent);
		}
		& [aria-current="page"] {
			position: relative;
			color: var(--light-text);
			background: var(--primary-soft);
			border-color: var(--primary-line);
			pointer-events: none;
		}
		& .disabled {
			opacity: 0.4;
			pointer-events: none;
		}
	}
</style>
