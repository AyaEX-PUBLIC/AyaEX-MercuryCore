<script lang="ts">
	let {
		name,
		title,
		exact = false,
		description = "",
		ogImage = ""
	}: {
		name: string
		title?: string
		/** Use the title as the whole tab title, without " - {name}" */
		exact?: boolean
		description?: string
		ogImage?: string
	} = $props()

	let t = $derived(title || name)
</script>

<svelte:head>
	<title>{exact ? t : `${t} - ${name}`}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
	{/if}
</svelte:head>
