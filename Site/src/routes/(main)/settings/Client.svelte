<script lang="ts">
	import Form from "$components/forms/Form.svelte"
	import Select from "$components/forms/Select.svelte"
	import { superForm } from "$lib/validate"

	const { data }: { data: import("./$types").PageData } = $props()

	let { user } = $derived(data)
	let formData = $derived(superForm(data.clientForm))
</script>

<Form {formData} action="?/client" submit="<fa fa-save></fa> Save changes">
	<Select
		{formData}
		options={data.clientChannels}
		selected={user.clientChannel || "stable"}
		name="channel"
		label="Client channel"
		help={data.clientChannels
			.map(c => `<b>${c}</b>: ${data.clientChannelInfo[c]}`)
			.join("<br />")} />
</Form>
