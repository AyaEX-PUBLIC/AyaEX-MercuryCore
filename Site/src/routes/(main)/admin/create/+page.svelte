<script lang="ts">
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Select from "$components/forms/Select.svelte"
	import Textarea from "$components/forms/Textarea.svelte"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import types from "$lib/assetTypes"
	import { superForm } from "$lib/validate"

	const { data } = $props()

	let formDataManual = $derived(superForm(data.form))

	let tabData = $state(
		TabData(data.url, ["Asset creation"], ["fa-file-circle-plus"])
	)
</script>

<Head name={data.siteName} title="Asset creation - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Asset creation" />
			<h1>Asset creation</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<Tab bind:tabData>
		<Form
			formData={formDataManual}
			nopad
			enctype="multipart/form-data"
			submit="Create">
			<Select
				formData={formDataManual}
				options={Object.values(types)}
				name="type"
				label="Asset type" />
			<Input
				formData={formDataManual}
				name="name"
				label="Asset name"
				placeholder="Make sure to make it accurate" />
			<Textarea
				formData={formDataManual}
				name="description"
				label="Asset description"
				placeholder="Up to 1000 characters" />
			<Input
				formData={formDataManual}
				name="price"
				label="Asset price"
				type="number" />
			<Input
				formData={formDataManual}
				type="file"
				name="asset"
				label="Asset"
				help="Max image size: 20MB. Supported file types: .png, .jpg, .bmp, .rbxm, .xml" />
		</Form>
	</Tab>
</SidebarShell>
