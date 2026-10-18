<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Form from "$components/forms/Form.svelte"
	import Textarea from "$components/forms/Textarea.svelte"
	import Head from "$components/Head.svelte"
	import { superForm } from "$lib/validate"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	export const snapshot = formData
</script>

<Head name={data.siteName} title="Create a post in {data.categoryName}" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<Breadcrumbs
				path={[
					["Forum", "/forum"],
					[data.categoryName, `/forum/${data.categoryName}`]
				]}
				final="New post" />
			<h1>Create a post in {data.categoryName}</h1>
		</div>
	</div>
	<Form {formData} submit="Post">
		<Textarea
			{formData}
			rows={5}
			name="content"
			label="Post content"
			placeholder="Up to 3000 characters" />
	</Form>
</div>
