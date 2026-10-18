<script lang="ts">
	import Form from "$components/forms/Form.svelte"
	import Select from "$components/forms/Select.svelte"
	import Textarea from "$components/forms/Textarea.svelte"
	import Head from "$components/Head.svelte"
	import { superForm } from "$lib/validate"
	import reports from "./reports"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	export const snapshot = formData
</script>

<Head name={data.siteName} title="Report {data.reportee}" />

<div class="ctnr max-w-180">
	<div class="page-head">
		<div>
			<div class="eyebrow">Report</div>
			<h1>Report {data.reportee}</h1>
			<p>Tell us how you think {data.reportee} is breaking the rules.</p>
		</div>
	</div>

	<Form {formData}>
		<Select
			{formData}
			options={reports}
			name="category"
			label="Report category" />
		<Textarea
			{formData}
			name="note"
			label="Further information"
			placeholder="Up to 1000 characters"
			rows={5} />
	</Form>
</div>
