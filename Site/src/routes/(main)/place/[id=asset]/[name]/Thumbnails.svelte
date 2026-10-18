<script lang="ts">
	import fade from "$lib/fade"

	const {
		thumbnails,
		id,
		slug
	}: {
		thumbnails: number[]
		id: number
		slug: string
	} = $props()

	function scroll(e: MouseEvent) {
		const url = new URL((e.target as HTMLAnchorElement)?.href).hash.slice(1)
		document.getElementById(url)?.scrollIntoView(false) // (false) prevents page scrolling to top of element
	}
</script>

<div
	in:fade
	class="carousel flex overflow-hidden scroll-smooth">
	{#each thumbnails as _, i}
		{@const thumbs = thumbnails.length}
		<div
			id="slide{i + 1}"
			class={[
				"carousel-item box-content flex-none relative w-full",
				{ active: !i }
			]}>
			<img
				src="/place/{id}/{slug}/thumbnail/{i + 1}"
				class="w-full aspect-video object-cover block"
				alt="Place thumbnail" />
			{#if thumbs > 1}
				<div
					class="absolute flex justify-between top-1/2 -translate-y-1/2 left-4 right-4">
					<a
						href="#slide{i < 1 ? thumbs : i}"
						class="carousel-button"
						onclick={e => {
							e.preventDefault()
							scroll(e)
						}}>
						❮
					</a>
					<a
						href="#slide{i === thumbs - 1 ? 1 : i + 2}"
						class="carousel-button"
						onclick={e => {
							e.preventDefault()
							scroll(e)
						}}>
						❯
					</a>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.carousel {
		scroll-snap-type: x mandatory;
	}
	.carousel-item {
		scroll-snap-align: start;
	}

	.carousel-button {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		color: var(--light-text);
		background: color-mix(in srgb, var(--background) 80%, transparent);
		border: 1px solid var(--accent3);
		&:hover {
			background: var(--background);
		}
	}
</style>
