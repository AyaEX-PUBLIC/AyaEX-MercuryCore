<script lang="ts">
	import Form from "$components/forms/Form.svelte"
	import Select from "$components/forms/Select.svelte"
	import { placeRigTypes } from "$lib/rigTypes"
	import { superForm } from "$lib/validate"

	const { data }: { data: import("./$types").PageData } = $props()

	let formData = $derived(superForm(data.avatarForm))
</script>

<Form
	{formData}
	submit=" <fa fa-save></fa> Save changes"
	action="?/avatar&tab=Avatar">
	<Select
		{formData}
		name="rigType"
		label="Avatar type"
		options={placeRigTypes}
		selected={data.rigType}
		help="Both lets each player use the avatar type chosen on their Character page. Changes apply to players who join after saving." />
</Form>
