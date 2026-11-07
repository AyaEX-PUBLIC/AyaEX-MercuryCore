<script lang="ts">
	import Head from "$components/Head.svelte"
	import Navbar from "$components/Navbar.svelte"
	import PixelField from "$components/PixelField.svelte"

	const { data } = $props()

	let headline = $derived(data.longTagline || data.siteName)
</script>

<Head
	name={data.siteName}
	title={headline}
	description="{data.siteName}: {headline}"
	ogImage="/mercury.gif" />

<Navbar {data} />

<section class="hero">
	<PixelField
		clear={0.9}
		clearAt={[0.5, 0.5, 0.5, 0.26]}
		fadeTop={0.02}
		fadeBottom={0.02} />
	<div class="relative flex flex-col items-center text-center px-6">
		<h1 class="headline">{headline}</h1>
		<div class="flex flex-wrap justify-center gap-3 pt-8">
			<a href="/register" class="btn btn-lg btn-primary">
				Create an account
				<fa fa-arrow-right></fa>
			</a>
			<a href="/login" class="btn btn-lg btn-quatenary">Log in</a>
		</div>
	</div>
</section>

<style>
	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		/* the rest of the screen, below the header and its 1px border */
		min-height: calc(100dvh - var(--header-height) - 1px);
		display: grid;
		place-items: center;
	}

	.headline {
		font-size: clamp(2.75rem, 8vw, 5.5rem);
		font-weight: 600;
		line-height: 1.02;
		letter-spacing: -0.04em;
	}
</style>
