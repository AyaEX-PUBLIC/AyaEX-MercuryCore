<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Textarea from "$components/forms/Textarea.svelte"
	import Head from "$components/Head.svelte"
	import { superForm } from "$lib/validate"

	// import beautifyCurrency from "$lib/beautifyCurrency"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	export const snapshot = formData

	// const [, c1, c2] = beautifyCurrency(data.price)
</script>

<Head name={data.siteName} title="Create a place" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Create", "/develop"]]} final="New place" />
			<h1>Create a place</h1>
			<p>Give it a name now. You can upload the place file and pictures in its settings afterwards.</p>
		</div>
	</div>

<Form {formData} nopad submit="Create">
	<Input
		{formData}
		name="name"
		label="Place name"
		placeholder="Make sure to make it accurate" />
	<Textarea
		{formData}
		name="description"
		label="Description"
		placeholder="Up to 1000 characters" />
	<!-- selfhosted server addresses are only relevant to administrators -->
	{#if data.user.permissionLevel >= 5}
		<Input
			{formData}
			name="serverAddress"
			label="Server IP"
			placeholder="You can use a URL instead of an IP if you wish" />
		<Input
			{formData}
			type="number"
			name="serverPort"
			label="Server port"
			placeholder="1024-65536"
			help="Using a port number lower than 49152 may not work correctly." />
	{/if}
	<Input
		{formData}
		type="number"
		name="maxPlayers"
		label="Player limit"
		placeholder="1-99 players" />
	<Input
		{formData}
		type="checkbox"
		name="privateServer"
		label="Private server" />
</Form>
</div>
