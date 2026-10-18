<script lang="ts">
	import Head from "$components/Head.svelte"

	const { data } = $props()

	let [
		users,
		places,
		groups,
		assets,
		friendships,
		followerships,
		comments
	] = $derived(data.stats)
</script>

<Head name={data.siteName} title="Statistics" />

<div class="ctnr max-w-240">
	<div class="page-head">
		<div>
			<div class="eyebrow">{data.siteName}</div>
			<h1>Statistics</h1>
			<p>How big {data.siteName} has grown so far.</p>
		</div>
	</div>

	<h2 class="text-base pb-3">Totals</h2>
	<dl class="tiles grid grid-cols-2 md:grid-cols-4 mb-10">
		{#each [["Users", users], ["Places", places], ["Groups", groups], ["Assets", assets], ["Friendships", friendships], ["Followerships", followerships], ["Comments", comments]] as [name, value]}
			<div class="stat">
				<dt class="eyebrow">{name}</dt>
				<dd>{value}</dd>
			</div>
		{/each}
	</dl>

	<h2 class="text-base pb-3">Averages</h2>
	<dl class="tiles grid grid-cols-2 md:grid-cols-4">
		<div class="stat">
			<dt class="eyebrow">Friends per user</dt>
			<dd>{(friendships / users).toFixed(2)}</dd>
		</div>
		<div class="stat">
			<dt class="eyebrow">Followers per user</dt>
			<dd>{(followerships / users).toFixed(2)}</dd>
		</div>
	</dl>
</div>

<style>
	.stat {
		padding: 1rem 1.25rem;
		& dd {
			margin: 0;
			padding-top: 0.5rem;
			font-family: var(--font-mono);
			font-size: 1.75rem;
			font-weight: 500;
		}
	}
</style>
