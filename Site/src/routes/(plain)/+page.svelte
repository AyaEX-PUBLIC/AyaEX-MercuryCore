<script lang="ts">
	import Footer from "$components/Footer.svelte"
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

<div class="page">
	<Navbar {data} />

	<section class="hero">
		<PixelField
			clear={0.9}
			clearAt={[0.5, 0.5, 0.5, 0.26]}
			fadeTop={0.02}
			fadeBottom={0.15} />
		<div class="relative flex flex-col items-center text-center px-6 py-20">
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

	<Footer {data} />
</div>

<style>
	/* the hero fills the screen between the header and the footer */
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	.hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		flex: 1;
		display: grid;
		place-items: center;
		margin-bottom: -4rem; /* sits on the footer's border */
	}

	.headline {
		font-size: clamp(2.75rem, 8vw, 5.5rem);
		font-weight: 600;
		line-height: 1.02;
		letter-spacing: -0.04em;
	}
</style>
