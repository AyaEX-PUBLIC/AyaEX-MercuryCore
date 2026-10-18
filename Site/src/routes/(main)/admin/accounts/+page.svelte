<script lang="ts">
	import Form from "$components/forms/Form.svelte"
	import Input from "$components/forms/Input.svelte"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import User from "$components/User.svelte"
	import { superForm } from "$lib/validate"

	const { data } = $props()

	let formData = $derived(superForm(data.form))
	export const snapshot = formData

	let tabData = $state(
		TabData(
			data.url,
			["Change user password", "Users"],
			["fa-key", "fa-user"]
		)
	)
</script>

<Head name={data.siteName} title="Accounts - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Accounts" />
			<h1>Accounts</h1>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<Tab bind:tabData>
		<Form
			{formData}
			submit="<fa fa-key></fa> Change password"
			action="?/changePassword">
			<Input {formData} name="username" label="Username" />
			<Input
				{formData}
				name="password"
				label="New password"
				type="password"
				placeholder={"•".repeat(20)} />
		</Form>
	</Tab>
	<Tab bind:tabData>
		<table class="w-full">
			<tbody>
				{#each data.users as user}
					<tr>
						<td><User {user} full thin bg="accent" /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</Tab>
</SidebarShell>

