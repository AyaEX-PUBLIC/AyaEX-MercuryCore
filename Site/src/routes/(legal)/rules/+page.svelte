<script lang="ts">
	import Head from "$components/Head.svelte"

	const { data } = $props()
</script>

<Head name={data.siteName} title="Rules" description="The rules of {data.siteName}" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<div class="eyebrow">Community</div>
			<h1>Rules</h1>
		</div>
	</div>

	<ol class="panel rules">
		<li>Be civil.</li>
	</ol>
</div>

<style>
	.rules {
		counter-reset: rule;
		list-style: none;
		margin: 0;
		padding: 0;
		& li {
			counter-increment: rule;
			display: flex;
			align-items: baseline;
			gap: 1rem;
			padding: 1rem 1.25rem;
			font-size: 1.125rem;
			& + li {
				border-top: 1px solid var(--accent2);
			}
			&::before {
				content: counter(rule, decimal-leading-zero);
				font-family: var(--font-mono);
				font-size: 0.75rem;
				color: var(--dim-text);
			}
		}
	}
</style>
