<script lang="ts">
	// If an error happens in any +page or +layout file, this page will be rendered instead.

	import { page } from "$app/state"
	import Footer from "$components/Footer.svelte"
	import Head from "$components/Head.svelte"
	import Navbar from "$components/Navbar.svelte"
	import PixelField from "$components/PixelField.svelte"

	const {
		data
	}: {
		data: import("./$types").LayoutData
	} = $props()

	const status = page.status
	// messages that only repeat the status, e.g. "Not Found"
	const generic = /^(not found|internal error|forbidden|unauthorized|bad request)$/i
	function title() {
		if (status === 401 || status === 403) return "You can't see this"
		if (status === 404) return "Page not found"
		if (status < 500) return "Something's not right"
		return "Something went wrong"
	}
</script>

<Head name={data.siteName} title="Error {status}" />

<Navbar {data} />

<main class="flex-1 flex flex-col">
	<section class="error flex-1">
		<PixelField
			clear={0.9}
			clearAt={[0.5, 0.5, 0.55, 0.36]}
			fadeTop={0.05}
			fadeBottom={0.05}
			density={0.9}
			seed={status} />
		<div class="ctnr relative flex flex-col items-center justify-center text-center h-full py-24">
			<a
				href="https://http.cat/images/{status}.jpg"
				target="_blank"
				rel="noreferrer"
				class="code light-text">
				{status}
			</a>
			<h1 class="pt-4">{title()}</h1>
			{#if page.error?.message && !generic.test(page.error.message)}
				<p class="grey-text pt-3 max-w-120">{page.error.message}</p>
			{/if}
			<div class="flex flex-wrap justify-center gap-3 pt-6">
				<a href={data.user ? "/home" : "/"} class="btn btn-primary">
					<fa fa-house-chimney></fa>
					Head home
				</a>
				<button class="btn btn-quatenary" onclick={() => history.back()}>
					<fa fa-arrow-left></fa>
					Go back
				</button>
			</div>
		</div>
	</section>
</main>

<Footer {data} />

<style>
	.error {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		min-height: 32rem;
		margin-bottom: -4rem; /* sits on the footer's border */
	}

	.code {
		font-family: var(--font-mono);
		font-size: clamp(5rem, 14vw, 9rem);
		font-weight: 600;
		line-height: 1;
		letter-spacing: -0.06em;
	}
</style>
