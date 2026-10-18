<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Head from "$components/Head.svelte"
	import { superForm } from "$lib/validate"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	export const snapshot = formData
</script>

<Head name={data.siteName} title="Create a forum category" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Forum", "/forum"]]} final="New category" />
			<h1>Create a forum category</h1>
		</div>
	</div>
	<Form {formData} submit="Create">
		<Input
			{formData}
			name="name"
			label="Category name"
			placeholder="Make sure to make it accurate" />
		<Input
			{formData}
			name="description"
			label="Category description"
			placeholder="Give it some further detail" />
	</Form>
</div>
