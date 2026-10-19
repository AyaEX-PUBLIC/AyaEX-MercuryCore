<script lang="ts">
	import Head from "$components/Head.svelte"
	import PixelField from "$components/PixelField.svelte"

	const { data } = $props()
</script>

<Head
	name={data.siteName}
	title="About"
	description="About {data.siteName}{data.longTagline
		? `: ${data.longTagline}`
		: ''}" />

<section class="hero -mt-8 lg:-mt-10">
	<PixelField
		clear={0.9}
		clearAt={[0.5, 0.5, 0.6, 0.32]}
		fadeTop={0.05}
		fadeBottom={0.2}
		seed={3} />
	<div class="ctnr relative flex flex-col items-center text-center py-24 lg:py-32">
		<span class="eyebrow pb-5">About</span>
		<h1 class="headline">{data.siteName}</h1>
		{#if data.longTagline}
			<p class="lead pt-5">{data.longTagline}</p>
		{/if}
		{#if data.tagline}
			<span class="badge mt-6">{data.tagline}</span>
		{/if}
	</div>
</section>

<div class="ctnr">
	<section class="part">
		<div>
			<h2>A refurbished experience</h2>
		</div>
		<div>
			<h3>New features.</h3>
			<p>
				{data.siteName} aims to be the foremost platform of its kind, and
				the {data.siteName} website plays a prominent part in this. After
				years of testing, tinkering, and tweaking, we've landed on a stack
				that combines rock-solid stability with a flexible foundation for
				the future.
			</p>
			<h3>Limitless possibilities.</h3>
			<p>
				{data.siteName} provides everything you would expect from a modern
				revival platform and then some:
			</p>
			<ul>
				<li>An expansive catalog for character customisation</li>
				<li>An innovative, robust, and intuitive user interface</li>
				<li>A vast variety of places and games to explore</li>
				<li>
					And communication features that help foster a sense of
					connection and community within {data.siteName}.
				</li>
			</ul>
			<h3>Same nostalgia.</h3>
			<p>
				{data.siteName} still uses the exact same client as the previous
				2 iterations. Our philosophy when it comes to our client is to make
				sure that it is accurately represented. The end-goal with our client
				is to implement every feature that it originally had.
			</p>
		</div>
	</section>

	<section class="part">
		<div>
			<h2>Security and privacy</h2>
		</div>
		<div>
			<h3>No passwords</h3>
			<p>
				{data.siteName} accounts sign in with a 12-word recovery phrase,
				generated with the BIP39 standard, instead of a password. Your
				browser turns the phrase into a signing key and proves it's you by
				signing a one-time challenge, so the phrase never leaves your device
				and our servers only keep the matching public key. There's no
				password to leak, guess or reuse, and a copy of our database
				wouldn't let anyone sign in as you.
			</p>
			<p>
				Keep your phrase private and somewhere safe: anyone who has it can
				sign in to your account. The console app signs in with a short code
				you approve on the website, so you never type your phrase there.
			</p>
			<h3>A client that runs in your browser</h3>
			<p>
				The Aya client is built for WebAssembly and runs inside your
				browser's sandbox, like any other web page. There's nothing to
				download or install, and nothing that can reach your files or the
				rest of your computer. Only signed-in players can load it, and game
				servers only let in players who arrive with a one-time ticket from
				the website.
			</p>
		</div>
	</section>
</div>

{#if !data.user}
	<section class="cta">
		<PixelField
			clear={0.75}
			clearAt={[0.5, 0.5, 0.55, 0.3]}
			fadeTop={0.15}
			fadeBottom={0.15}
			seed={11} />
		<div class="ctnr relative flex flex-col items-center text-center py-24">
			<h2 class="headline">Join {data.siteName}</h2>
			{#if data.longTagline}
				<p class="lead pt-4">{data.longTagline}</p>
			{/if}
			<a href="/register" class="btn btn-lg btn-secondary mt-7">
				Create an account
				<fa fa-arrow-right></fa>
			</a>
		</div>
	</section>
{/if}

<style>
	.hero,
	.cta {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		border-bottom: 1px solid var(--accent2);
	}

	.cta {
		margin-bottom: -4rem; /* sits on the footer's border */
		border-top: 1px solid var(--accent2);
		border-bottom: 0;
	}

	.headline {
		font-size: clamp(2.5rem, 6vw, 4.25rem);
		font-weight: 600;
		line-height: 1.04;
		letter-spacing: -0.035em;
	}

	.lead {
		max-width: 38rem;
		padding-bottom: 0;
		font-size: 1.125rem;
		color: var(--grey-text);
	}

	/* a heading on the left, its text on the right */
	.part {
		display: grid;
		gap: 1.5rem 4rem;
		padding: 4rem 0;
		& + .part {
			border-top: 1px solid var(--accent2);
		}
		@media (min-width: 1024px) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
			padding: 5rem 0;
		}
		& h2 {
			font-size: clamp(1.75rem, 3vw, 2.25rem);
			letter-spacing: -0.03em;
		}
		& h3 {
			padding: 1.5rem 0 0.5rem;
			font-size: 1.125rem;
			&:first-child {
				padding-top: 0;
			}
		}
		& p,
		& li {
			color: var(--grey-text);
			line-height: 1.7;
		}
		& ul {
			display: grid;
			gap: 0.5rem;
			padding-bottom: 1rem;
			list-style: none;
		}
		& li {
			padding-left: 1.25rem;
			position: relative;
			&::before {
				content: "";
				position: absolute;
				left: 0;
				top: 0.7em;
				width: 0.375rem;
				height: 0.375rem;
				background: var(--primary);
			}
		}
	}
</style>
