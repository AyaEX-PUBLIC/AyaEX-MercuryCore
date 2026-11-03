<script lang="ts">
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import { superForm } from "$lib/validate"

	const {
		data
	}: {
		data: import("./$types").PageData
	} = $props()

	let formData = $derived(superForm(data.networkForm))
	let { form } = $derived(formData)

	if (data.serverAddress) $form.serverAddress = data.serverAddress
	if (data.serverPort) $form.serverPort = data.serverPort
	if (data.maxPlayers) $form.maxPlayers = data.maxPlayers
</script>

<Form
	{formData}
	submit=" <fa fa-save></fa> Save changes"
	action="?/network&tab=Network">
	<!-- selfhosted server addresses are only relevant to administrators -->
	{#if data.user.permissionLevel >= 5}
		<Input {formData} name="serverAddress" label="Address" />
		<Input
			{formData}
			name="serverPort"
			label="Port"
			type="number"
			help="Using a port number lower than 49152 may not work correctly." />
	{/if}
	<Input {formData} name="maxPlayers" label="Server limit" type="number" />
</Form>
