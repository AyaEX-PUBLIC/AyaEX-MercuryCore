<script lang="ts">
	import Footer from "$components/Footer.svelte"
	import Head from "$components/Head.svelte"
	import Navbar from "$components/Navbar.svelte"
	import PixelField from "$components/PixelField.svelte"

	const { data } = $props()

	let description = $derived(
		`${data.siteName}${data.longTagline ? `: ${data.longTagline}` : ""}`
	)

	// The first sentence of the tagline on one line, the rest dimmed below it
	let [first, ...rest] = $derived(
		(data.longTagline || data.siteName).split(/(?<=[.!?])\s+/)
	)

	const icons = ["fa-mountain-sun", "fa-sliders", "fa-heart"]

	const inside = [
		{
			icon: "fa-mountain-sun",
			name: "Games",
			text: "Play places made by the community, right in your browser."
		},
		{
			icon: "fa-book-open-cover",
			name: "Catalog",
			text: "Dress up your character with hats, faces, shirts and gear."
		},
		{
			icon: "fa-hammer",
			name: "Create",
			text: "Build places, upload clothing and sell passes in your games."
		},
		{
			icon: "fa-user-group",
			name: "Friends",
			text: "Add friends, follow people and see what they're playing."
		}
	]
</script>

<Head
	name={data.siteName}
	title={description}
	{description}
	ogImage="/mercury.gif" />

<Navbar {data} />

<main class="flex-1">
	<section class="hero">
		<PixelField
			clear={0.9}
			clearAt={[0.5, 0.5, 0.62, 0.32]}
			fadeTop={0.02}
			fadeBottom={0.2} />
		<div class="ctnr relative flex flex-col items-center text-center py-28 lg:py-40">
			{#if data.tagline}
				<span class="badge mb-7">{data.tagline}</span>
			{/if}
			<h1 class="headline">
				{first}
				{#if rest.length}
					<br />
					<span class="dim">{rest.join(" ")}</span>
				{/if}
			</h1>
			{#if data.descriptions[0]}
				<p class="lead pt-6">{data.descriptions[0][1]}</p>
			{/if}
			<div class="flex flex-wrap justify-center gap-3 pt-6">
				<a href="/register" class="btn btn-lg btn-primary">
					Create an account
					<fa fa-arrow-right></fa>
				</a>
				<a href="/login" class="btn btn-lg btn-quatenary">Log in</a>
			</div>
		</div>
	</section>

	<section class="ctnr py-20 lg:py-28">
		<div class="eyebrow pb-4">Why {data.siteName}</div>
		<div class="tiles grid md:grid-cols-3">
			{#each data.descriptions as [title, text], i}
				<div class="p-6 lg:p-8">
					<fa class={["accent-text", icons[i % icons.length]]}></fa>
					<h3 class="text-base pt-8">{title}</h3>
					<p class="grey-text text-sm pt-2 pb-0">{text}</p>
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 pt-20 lg:pt-28">
			<div>
				<h2 class="headline-sm">
					Everything in one place.
					<br />
					<span class="dim">No downloads.</span>
				</h2>
				<p class="grey-text pt-4">
					Games open in the browser, so there's nothing to install
					before you play.
				</p>
			</div>
			<div class="grid sm:grid-cols-2 gap-x-10 gap-y-8 content-start">
				{#each inside as item}
					<div>
						<div class="flex items-center gap-3">
							<fa class={["accent-text text-sm", item.icon]}></fa>
							<h3 class="text-base">{item.name}</h3>
						</div>
						<p class="grey-text text-sm pt-2 pb-0">{item.text}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="cta">
		<PixelField
			clear={0.75}
			clearAt={[0.5, 0.5, 0.55, 0.3]}
			fadeTop={0.15}
			fadeBottom={0.15}
			seed={21} />
		<div class="ctnr relative flex flex-col items-center text-center py-28 lg:py-36">
			<h2 class="headline">Ready to jump in?</h2>
			<p class="lead pt-5">
				Make an account, pick a game and start playing in a minute.
			</p>
			<div class="flex flex-wrap justify-center gap-3 pt-7">
				<a href="/register" class="btn btn-lg btn-secondary">
					Create an account
					<fa fa-arrow-right></fa>
				</a>
				<a href="/about" class="btn btn-lg btn-quatenary">
					About {data.siteName}
				</a>
			</div>
		</div>
	</section>
</main>

<Footer {data} />

<style>
	.hero,
	.cta {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		border-bottom: 1px solid var(--accent2);
	}

	.cta {
		border-top: 1px solid var(--accent2);
		border-bottom: 0;
		margin-bottom: -4rem; /* sits on the footer's border */
	}

	.headline {
		max-width: 64rem;
		font-size: clamp(2.5rem, 6vw, 4.25rem);
		font-weight: 600;
		line-height: 1.04;
		letter-spacing: -0.035em;
	}

	.headline-sm {
		font-size: clamp(2rem, 4vw, 2.75rem);
		font-weight: 600;
		line-height: 1.08;
		letter-spacing: -0.03em;
	}

	.dim {
		color: var(--grey-text);
	}

	.lead {
		max-width: 38rem;
		padding-bottom: 0;
		font-size: 1.125rem;
		line-height: 1.6;
		color: var(--grey-text);
	}
</style>
