<script lang="ts">
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import Account from "./Account.svelte"
	import Client from "./Client.svelte"
	import Profile from "./Profile.svelte"
	import Security from "./Security.svelte"
	import Styling from "./Styling.svelte"

	const { data } = $props()

	let { user } = $derived(data)

	let tabData = $state(
		TabData(
			data.url,
			["Profile", "Account", "Security", "Styling", "Client"],
			["fa-id-card", "fa-user", "fa-lock", "fa-paint-brush", "fa-sliders"]
		)
	)
</script>

<Head name={data.siteName} title="Settings" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">You</div>
			<h1>Settings</h1>
			<p>Your profile, account, security and how the site looks for you.</p>
		</div>
		<a href="/user/{user.username}" class="btn btn-tertiary">
			<fa fa-user></fa>
			View profile
		</a>
	</div>
</div>

<SidebarShell bind:tabData>
	<div class="max-w-180">
		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Profile</div>
				<div class="p-5">
					<p class="grey-text text-sm">Change your description, site theme and more.</p>
					<Profile {data} />
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Account</div>
				<div class="p-5">
					<p class="grey-text text-sm">Information about your account.</p>
					<Account {data} />
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Security</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Keep your account secure by changing your password and
						signing out other devices.
					</p>
					<Security {data} />
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Styling</div>
				<div class="p-5">
					<Styling {data} />
				</div>
			</section>
		</Tab>

		<Tab bind:tabData>
			<section class="panel">
				<div class="panel-head">Client</div>
				<div class="p-5">
					<p class="grey-text text-sm">
						Choose which build of the game client opens when you press Play.
					</p>
					<Client {data} />
				</div>
			</section>
		</Tab>
	</div>
</SidebarShell>
