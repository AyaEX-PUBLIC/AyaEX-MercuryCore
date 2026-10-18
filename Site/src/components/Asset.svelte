<script lang="ts">
	// A catalog item tile, used in the catalog, inventory and search pages.

	import fade from "$lib/fade"

	const {
		asset,
		num,
		total,
		symbol
	}: {
		asset: {
			id: number
			name: string
			price: number
		}
		num: number
		total: number
		symbol: string
	} = $props()
</script>

<a
	in:fade|global={{ num, total }}
	href="/catalog/{asset.id}/{asset.name}"
	class="item light-text">
	<div class="thumb">
		<img
			src="/catalog/{asset.id}/{asset.name}/icon"
			alt=""
			loading="lazy" />
	</div>
	<div class="info">
		<span class="name">{asset.name}</span>
		<span class="price">
			{#if asset.price > 0}
				<span class="symbol">{symbol}</span>
				{asset.price}
			{:else}
				Free
			{/if}
		</span>
	</div>
</a>

<style>
	.item {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background);
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
			& img {
				scale: 1.06;
			}
		}
	}

	.thumb {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		padding: 12%;
		overflow: hidden;
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
			transition: scale 0.3s;
		}
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		padding: 0 0.75rem 0.75rem;
	}

	.name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 0.875rem;
		line-height: 1.3;
	}

	.price {
		margin-top: auto;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--success);
	}

	.symbol {
		opacity: 0.8;
	}
</style>
