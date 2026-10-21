<script lang="ts">
	const {
		data
	}: {
		data: import("../routes/$types").LayoutData
	} = $props()

	let clicked = $state(false)
</script>

<footer>
	<div class="ctnr">
		<div class="max-w-72 py-8">
			<a href="/" class="brand">
				<img src="/assets/icon" alt="" class="size-5" />
				{data.siteName}
			</a>
			{#if data.longTagline || data.tagline}
				<p class="grey-text text-sm pt-3">
					{data.longTagline || data.tagline}
				</p>
			{/if}
		</div>
		<div class="fine">
			<span>
				&copy; {new Date().getFullYear()}
				{data.siteName}{data.tagline ? ` · ${data.tagline}` : ""}
			</span>
			<button
				onmousedown={() => {
					clicked = !clicked
				}}
				id="heart"
				class={{ clicked }}>
				<span class="s1">made with</span>
				<fa fa-heart></fa>
				<span class="s2">in 🏴󠁧󠁢󠁳󠁣󠁴󠁿</span>
			</button>
		</div>
	</div>
</footer>

<noscript>
	<div id="nojs">
		Javascript is disabled. You may have a diminished experience while using {data.siteName}.
	</div>
</noscript>

<style>
	footer {
		flex-shrink: 0;
		margin-top: 4rem;
		border-top: 1px solid var(--accent2);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--light-text);
	}

	.fine {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 2rem;
		padding: 1.25rem 0 1.5rem;
		font-size: 0.8125rem;
		color: var(--dim-text);
		border-top: 1px solid var(--accent2);
	}

	#heart {
		display: inline-flex;
		align-items: center;
		padding: 0;
		font: inherit;
		color: var(--dim-text);
		background: none;
		border: 0;
		cursor: pointer;

		& fa {
			transition: 0.2s;
		}

		& span {
			transition: all 0.3s;
			display: inline-block;
			overflow: hidden;
			white-space: nowrap;
			width: 0;
		}

		&:hover .s1 {
			width: 5rem;
			padding: 0 0.3rem;
		}
		&:hover .s2 {
			width: 2.5rem;
			padding: 0 0.3rem;
		}

		&:not(.clicked) fa:hover {
			color: var(--light-text);
		}
	}

	@keyframes heart {
		0% {
			transform: scale(1);
		}
		15% {
			transform: scale(0.9);
			rotate: -10deg;
		}
		25% {
			transform: scale(1);
			rotate: 5deg;
		}
		40% {
			transform: scale(1.2);
			filter: drop-shadow(0 0 3px var(--pixel-3));
		}
		100% {
			transform: scale(1);
			rotate: 0;
		}
	}

	.clicked fa {
		animation: heart 2s;
	}
	.clicked {
		& fa,
		& span {
			color: var(--pixel-3) !important;
		}
	}

	#nojs {
		position: fixed;
		bottom: 0;
		width: 100%;
		padding: 0.5rem;
		font-size: 0.875rem;
		text-align: center;
		background: rgb(0 0 0 / 0.75);
	}
</style>
