<script lang="ts">
	const { path, final }: { path: [string, string][]; final: string } =
		$props()
</script>

<nav aria-label="breadcrumb">
	<ol class="eyebrow flex flex-wrap list-none items-center m-0 p-0">
		{#each path as [name, href]}
			<li><a {href} class="grey-text">{name}</a></li>
		{/each}
		<li class="light-text truncate max-w-full">{final}</li>
	</ol>
</nav>

<style>
	li:not(:last-child)::after {
		content: "/";
		padding: 0 0.5rem;
		color: var(--dim-text);
	}
</style>
