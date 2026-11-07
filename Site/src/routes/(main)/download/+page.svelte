<script lang="ts">
	import type { Snippet } from "svelte"
	import Head from "$components/Head.svelte"

	const { data } = $props()

	type ClientFile = { name: string; size: number; updated: number } | null

	const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`
	const date = (ms: number) =>
		new Date(ms).toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric"
		})
</script>

<Head
	name={data.siteName}
	title="Download"
	description="Console clients for {data.siteName}" />

{#snippet client(
	platform: string,
	about: string,
	file: ClientFile,
	href: string,
	steps: Snippet
)}
	<section class="panel">
		<div class="panel-head">
			<span>{platform}</span>
			<span class="badge">Homebrew</span>
		</div>
		<div class="grid lg:grid-cols-[1fr_20rem]">
			<div class="p-5 lg:p-6">
				<h2 class="text-2xl">AyaEX</h2>
				<p class="grey-text pt-2 max-w-130">{about}</p>
				<ol class="steps">
					{@render steps()}
				</ol>
			</div>
			<div class="side">
				{#if file}
					<dl class="kv">
						<div>
							<dt>File</dt>
							<dd class="mono">{file.name}</dd>
						</div>
						<div>
							<dt>Size</dt>
							<dd>{megabytes(file.size)}</dd>
						</div>
						<div>
							<dt>Updated</dt>
							<dd>{date(file.updated)}</dd>
						</div>
					</dl>
					<div class="p-4">
						<a {href} class="btn btn-primary btn-lg w-full" download>
							<fa fa-arrow-down></fa>
							Download
						</a>
					</div>
				{:else}
					<p class="grey-text p-4">Not available yet. Check back soon.</p>
				{/if}
			</div>
		</div>
	</section>
{/snippet}

<!-- one span per step, so its code and links stay in the text -->
{#snippet signIn()}
	<li>
		<span>
			Choose {data.siteName}, then approve the code it shows on
			<a href="/device">{data.domain}/device</a>, signed in on your phone or
			computer.
		</span>
	</li>
{/snippet}

{#snippet switchSteps()}
	<li>
		<span>
			Copy <code>{data.switchClient?.name || "Aya.Switch.nro"}</code> to
			<code>sdmc:/switch/aya/</code> on the SD card.
		</span>
	</li>
	<li>
		<span>
			Open the Homebrew Menu from a game, holding R while it starts, so AyaEX
			gets the console's full memory, and start AyaEX.
		</span>
	</li>
	{@render signIn()}
{/snippet}

{#snippet wiiuSteps()}
	<li>
		<span>
			Copy <code>{data.wiiuClient?.name || "AyaEX.wuhb"}</code> to
			<code>wiiu/apps/</code> on the SD card.
		</span>
	</li>
	<li>
		<span>
			Start the Wii U with Aroma, and open AyaEX from the Wii U Menu.
		</span>
	</li>
	{@render signIn()}
{/snippet}

<div class="ctnr max-w-240">
	<div class="page-head">
		<div>
			<div class="eyebrow">Download</div>
			<h1>Console clients</h1>
			<p>
				In a browser there's nothing to download: open a game and press Play. To
				play on a console, install its client below.
			</p>
		</div>
	</div>

	<div class="grid gap-6">
		{@render client(
			"Nintendo Switch",
			`Play ${data.siteName} games, and places from your SD card, on a Switch that runs homebrew.`,
			data.switchClient,
			"/download/switch",
			switchSteps
		)}
		{@render client(
			"Wii U",
			`Play ${data.siteName} games, and places from your SD card, on a Wii U running the Aroma homebrew environment.`,
			data.wiiuClient,
			"/download/wiiu",
			wiiuSteps
		)}
	</div>
</div>

<style>
	.steps {
		counter-reset: step;
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		& li {
			counter-increment: step;
			display: flex;
			gap: 0.875rem;
			padding: 0.625rem 0;
			color: var(--grey-text);
			& + li {
				border-top: 1px solid var(--accent2);
			}
			&::before {
				content: counter(step, decimal-leading-zero);
				font-family: var(--font-mono);
				font-size: 0.75rem;
				line-height: 1.6rem;
				color: var(--dim-text);
			}
		}
	}
	.side {
		border-top: 1px solid var(--accent2);
		@media (min-width: 1024px) {
			border-top: 0;
			border-left: 1px solid var(--accent2);
		}
	}
</style>
