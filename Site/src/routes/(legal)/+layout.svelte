<script lang="ts">
	import Footer from "$components/Footer.svelte"
	import Navbar from "$components/Navbar.svelte"

	const { data, children } = $props()
</script>

<!--
	Data from the root layout must be passed into components, as it cannot be accessed directly.
-->
<Navbar {data} />

<main class="flex-1 pt-8 lg:pt-10">
	{@render children()}
</main>

<Footer {data} />
