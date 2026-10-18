<script lang="ts">
	// A place tile, used on the games, home and search pages and on profiles.

	import fade from "$lib/fade"
	import { encode } from "$lib/urlName"

	const {
		place,
		num,
		total
	}: {
		place: {
			id: number | string
			name: string
			likeCount: number
			dislikeCount: number
			playerCount: number
			serverPing?: number
			clientVersion?: number
		}
		num: number
		total: number
	} = $props()

	let slug = $derived(encode(place.name))
	let ratio = $derived(
		Math.floor(
			(place.likeCount / (place.likeCount + place.dislikeCount)) * 100
		)
	)
	let online = $derived(
		place.serverPing !== undefined &&
			place.serverPing > Date.now() / 1000 - 35
	)
</script>

<a
	in:fade|global={{ num, total }}
	class="place light-text"
	href="/place/{place.id}/{slug}">
	<div class="thumb">
		<img
			src="/place/{place.id}/{slug}/icon"
			alt=""
			loading="lazy" />
		{#if place.clientVersion}
			<span class="badge version">{place.clientVersion}</span>
		{/if}
		{#if online}
			<span class="badge badge-success live">
				<span class="dot on"></span>
				Live
			</span>
		{/if}
	</div>
	<div class="info">
		<span class="name">{place.name}</span>
		<span class="stats">
			<span title="Rating">
				<fa fa-thumbs-up></fa>
				{Number.isNaN(ratio) ? "--" : ratio}%
			</span>
			<span title="Playing now">
				<fa fa-user></fa>
				{place.playerCount}
			</span>
		</span>
	</div>
</a>

<style>
	.place {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background);
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
			& img {
				scale: 1.04;
			}
		}
	}

	.thumb {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--darker);
		border-bottom: 1px solid var(--accent2);
		& img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			transition: scale 0.3s;
		}
		& .badge {
			position: absolute;
			color: var(--light-text);
			background: rgb(0 0 0 / 0.7);
			border-color: rgb(255 255 255 / 0.15);
		}
		& .version {
			left: 0.5rem;
			bottom: 0.5rem;
		}
		& .live {
			top: 0.5rem;
			left: 0.5rem;
			color: var(--success);
			border-color: var(--success-line);
		}
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		flex: 1;
		padding: 0.625rem 0.75rem 0.75rem;
	}

	.name {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.stats {
		display: flex;
		justify-content: space-between;
		margin-top: auto;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--grey-text);
		& fa {
			font-size: 0.6875rem;
			padding-right: 0.25rem;
			opacity: 0.8;
		}
	}
</style>
