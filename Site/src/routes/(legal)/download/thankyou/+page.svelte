<script lang="ts">
	import Head from "$components/Head.svelte"

	const { data } = $props()
</script>

<Head name={data.siteName} title="Thank You" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<div class="eyebrow">Download</div>
			<h1>Welcome to {data.siteName}</h1>
			<p>
				Thank you for downloading our client. To get started, head over to
				<a href="/games">Games</a> to start playing! If you don't have an account
				with us, you can <a href="/register">register here</a>.
			</p>
		</div>
	</div>
</div>
