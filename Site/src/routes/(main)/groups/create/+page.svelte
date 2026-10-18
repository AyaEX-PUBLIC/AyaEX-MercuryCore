<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Head from "$components/Head.svelte"
	import beautifyCurrency from "$lib/beautifyCurrency"
	import { superForm } from "$lib/validate"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	export const snapshot = formData

	const [, c1, c2] = beautifyCurrency(data.price)
</script>

<Head name={data.siteName} title="Create a group" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Groups", "/groups"]]} final="New group" />
			<h1>Create a group</h1>
		</div>
	</div>

	<Form
		{formData}
		nopad
		submit="Create ({data.currencySymbol}{c1}{c2 ? '.' : ''}{c2})">
		<Input
			{formData}
			name="name"
			label="Group name"
			placeholder="This cannot be changed. Choose wisely." />
	</Form>
</div>
