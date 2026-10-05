<script lang="ts">
	import { get } from "svelte/store"
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Textarea from "$components/forms/Textarea.svelte"
	import { superForm } from "$lib/validate"

	const { data }: { data: import("./$types").PageData } = $props()

	let formData = $derived(superForm(data.viewForm))
	let { form } = $derived(formData)

	$effect(() => {
		if (data.description && !get(formData.form).description)
			$form.description = data.description
	})
</script>

<Form
	{formData}
	enctype="multipart/form-data"
	submit=" <fa fa-save></fa> Save changes"
	action="?/view&tab=View">
	<Input {formData} name="name" label="Name" />
	<Input
		{formData}
		name="icon"
		label="Place icon"
		type="file"
		accept="image/*" />
	<Input
		{formData}
		name="thumbnail"
		label="Place thumbnail"
		type="file"
		accept="image/*"
		help="Shown on the place page, cropped to 16:9 (1280×720)." />

	<hr class="grey-text pb-6" />

	<Textarea
		{formData}
		name="description"
		label="Description"
		placeholder="Up to 1000 characters"
		rows={3} />
</Form>
