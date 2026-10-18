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
			<h3>Data protection</h3>
			<p>
				We take the security and privacy of our users very seriously. No
				identifying information is stored on our servers, and no data is
				shared with third parties.
			</p>
			<h3>Vulnerability management</h3>
			<p>
				Careful technology choices ensure that {data.siteName} isn't vulnerable
				to the same attacks that plague similar platforms. We're constantly
				monitoring and updating our systems to ensure that users are safe
				&ndash; and a streamlined reporting system allows us to respond to
				any security concerns quickly and effectively.
			</p>
		</div>
	</section>

	<section class="part">
		<div>
			<h2>Transparency and trust</h2>
		</div>
		<div class="tiles grid md:grid-cols-2">
			<div class="p-6">
				<h3 class="pt-0!">Professional developers</h3>
				<p>
					A group of experienced developers are behind {data.siteName},
					and we're committed to improving user experience and
					security. We aim to remain transparent and open about
					our development process and decisions.
				</p>
			</div>
			<div class="p-6">
				<h3 class="pt-0!">Community outreach</h3>
				<p>
					Our team of testers contribute extensively to the
					platform's development and direction, and we're always
					open to feedback and suggestions from the community.
				</p>
			</div>
		</div>
	</section>

	<section class="part">
		<div>
			<h2>Development experience</h2>
		</div>
		<div>
			<h3>Library usage</h3>
			<p>
				We put a strong emphasis on library usage to improve development
				speed and maintainability. {data.siteName} is the first revival platform
				to utilise modern libraries and frameworks backported from contemporary
				Lua, Luau, and JavaScript ecosystems.
			</p>
			<h3>Optimisation and stability</h3>
			<p>
				{data.siteName} makes use of techniques borrowed from modern game
				development to boost performance and reduce latency. Our optimisations
				have already been proven to improve user experience &ndash; for example,
				place joining on {data.siteName} is 30-40% faster than competing
				platforms.
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
