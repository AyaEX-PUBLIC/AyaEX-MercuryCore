<script lang="ts">
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import AvatarForm from "./Avatar.svelte"
	import DataForm from "./Data.svelte"
	import NetworkForm from "./Network.svelte"
	import PrivacyForm from "./Privacy.svelte"
	import PrivatelinkForm from "./Privatelink.svelte"
	import Store from "./Store.svelte"
	import TicketForm from "./Ticket.svelte"
	import ViewForm from "./View.svelte"

	const { data } = $props()

	let tabData = $state(
		TabData(
			data.url,
			["View", "Network", "Avatar", "Privacy", "Data", "Store"],
			["fa-eye", "fa-network-wired", "fa-user", "fa-eye-low-vision", "fa-database", "fa-coins"]
		)
	)
</script>

<Head name={data.siteName} title="{data.name} Settings" />

<!--
	Pretty chuffed with this way of organising forms, makes it way easier to have multiple forms on a page without them messing each other up.
 -->
<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs
				path={[
					["Games", "/games"],
					[data.name, `/place/${data.id}/${data.slug}`]
				]}
				final="Settings" />
			<h1>Configure {data.name}</h1>
		</div>
		<a href="/place/{data.id}/{data.slug}" class="btn btn-tertiary">
			<fa fa-arrow-left></fa>
			Back to place
		</a>
	</div>
</div>

<SidebarShell bind:tabData>
	<div class="max-w-200">
		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Server view</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Change the title, pictures and description of your place.
					</p>
					<ViewForm {data} />
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Network</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Change the network configurations of your server.
					</p>
					<TicketForm {data} />
					{#key data.serverTicket}
						<NetworkForm {data} />
					{/key}
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Avatar</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Choose whether players spawn as R6 or R15 characters.
					</p>
					{#key data.rigType}
						<AvatarForm {data} />
					{/key}
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Privacy</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Enable private server to make your game only accessible to
						those with the link.
					</p>
					<PrivatelinkForm {data} />
					{#key data.privateTicket}
						<PrivacyForm {data} />
					{/key}
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Data</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Configure place data saved to {data.siteName}.
					</p>
					<DataForm {data} />
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Store</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Sell game passes and developer products, and create badges
						for your game. Sales are paid to you in {data.siteName} currency.
					</p>
					<Store {data} />
				</div>
			</section>
		</Tab>
	</div>
</SidebarShell>
