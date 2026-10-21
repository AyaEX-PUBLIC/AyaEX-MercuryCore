<script lang="ts">
	import type { Snippet } from "svelte"
	import { page } from "$app/state"
	import PixelField from "$components/PixelField.svelte"

	const {
		name,
		tagline,
		descriptions,
		children
	}: {
		name: string
		tagline: string
		descriptions: [string, string][]
		/** No longer used; kept for compatibility */
		pad?: boolean
		children?: Snippet
	} = $props()
</script>

<div class="shell">
	<section class="art">
		<PixelField density={1.15} fadeTop={0} fadeBottom={0.5} seed={7} />
		<div class="relative flex flex-col h-full p-8 lg:p-12">
			<a href="/" class="brand">
				<img src="/assets/icon" alt="" class="size-6" />
				{name}
			</a>
			<div class="mt-auto pt-16 <lg:hidden">
				{#if tagline}
					<span class="badge mb-5">
						{tagline}
						<span class="version">{page.data.version}</span>
					</span>
				{/if}
				<dl class="grid gap-px max-w-110">
					{#each descriptions as [title, description]}
						<div class="item">
							<dt class="font-600">{title}</dt>
							<dd class="grey-text text-sm m-0 pt-1">{description}</dd>
						</div>
					{/each}
				</dl>
			</div>
		</div>
	</section>

	<section class="form">
		<div class="w-full max-w-100 mx-auto">
			{@render children?.()}
		</div>
	</section>
</div>

<style>
	.shell {
		display: grid;
		min-height: 100vh;
		min-height: 100dvh;
		@media (min-width: 1024px) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	.art {
		position: relative;
		overflow: hidden;
		border-right: 1px solid var(--accent2);
		@media (max-width: 1023.9px) {
			height: 10rem;
			border-right: 0;
			border-bottom: 1px solid var(--accent2);
		}
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		align-self: flex-start;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--light-text);
	}

	.item {
		padding: 1rem 1.25rem;
		background: color-mix(in srgb, var(--background) 85%, transparent);
		border: 1px solid var(--accent2);
		backdrop-filter: blur(6px);
		& + .item {
			border-top: 0;
		}
	}

	.form {
		display: flex;
		align-items: flex-start;
		padding: 2.5rem 1.5rem 4rem;
		@media (min-width: 1024px) {
			align-items: center;
		}
		& :global(form button.btn-primary) {
			width: 100%;
			margin-top: 0.5rem;
		}
		& :global(h2) {
			font-size: 1.75rem;
			letter-spacing: -0.03em;
		}
		& :global(h2 + p) {
			padding-top: 0.5rem;
			color: var(--grey-text);
		}
	}
</style>
