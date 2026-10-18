<script lang="ts">
	import AdminLink from "$components/AdminLink.svelte"
	import Head from "$components/Head.svelte"
	import permissionLevels from "$lib/permissionLevels"

	const { data } = $props()

	let { user, totalmem, freemem } = $derived(data)

	let perms = $derived(permissionLevels(user.permissionLevel))
	const _uno = [
		"fa-user",
		"fa-check",
		"fa-hammer",
		"fa-shield-alt",
		"fa-scale-balanced"
	]

	let sections = $derived(
		[
			[
				"Administration",
				[
					["Banners", "banners", "fa-bullhorn"],
					["Accounts", "accounts", "fa-user"],
					["Audit logs", "audit", "fa-book"],
					["Registration keys", "regkeys", "fa-key"],
					["Gameservers", "gameservers", "fa-server"],
					["FFlags", "fflags", "fa-flag"]
				]
			],
			[
				"Moderation",
				[
					["User moderation", "moderation", "fa-user-slash"],
					["Abuse reports", "reports", "fa-flag"],
					["Asset approval", "asset", "fa-file-circle-check"],
					["Render queue", "renderqueue", "fa-file-image"]
				]
			],
			["Catalog", [["Asset creation", "create", "fa-file-circle-plus"]]],
			[
				"Economy",
				[
					["Transactions", "transactions", "fa-money-bill-transfer"],
					["User balances", "balances", "fa-coins"]
				]
			]
		].filter(
			([name]) => name !== "Administration" || user.permissionLevel === 5
		) as [string, [string, string, string][]][]
	)

	let mbUsed = $derived((totalmem - freemem) / 1e3 ** 2)
	// they done let gbs in the door
	let gbUsed = $derived(mbUsed / 1e3)
	let gbTotal = $derived(totalmem / 1e3 ** 3)
</script>

<Head name={data.siteName} title="Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Staff</div>
			<h1>Admin panel</h1>
			<p>
				Your permission level is
				<span class="badge" style="color: {perms[0]}">
					<fa class={perms[1]}></fa>
					{perms[2]}
				</span>
			</p>
		</div>
		<div class="panel memory">
			<div class="flex justify-between gap-6 text-sm">
				<span class="eyebrow">Server memory</span>
				<span class="mono">{gbUsed.toFixed(2)} / {gbTotal.toFixed(2)} GB</span>
			</div>
			<div class="bar">
				<div
					role="progressbar"
					aria-label="Memory used"
					aria-valuenow={totalmem - freemem}
					aria-valuemin={0}
					aria-valuemax={totalmem}
					style="width: {((totalmem - freemem) / totalmem) * 100}%">
				</div>
			</div>
			<span class="grey-text text-xs">{Math.round(mbUsed)} MB in use</span>
		</div>
	</div>

	{#each sections as [name, links]}
		<h2 class="text-base pb-3">{name}</h2>
		<div class="tiles grid sm:grid-cols-2 lg:grid-cols-4 mb-10">
			{#each links as [title, href, icon], num}
				<AdminLink
					href="/admin/{href}"
					iconClass={icon}
					{num}
					total={links.length}
					name={title} />
			{/each}
		</div>
	{/each}
</div>

<style>
	.memory {
		gap: 0.5rem;
		width: min(100%, 20rem);
		padding: 0.875rem 1rem;
	}

	.bar {
		height: 4px;
		background: var(--accent2);
		& div {
			height: 100%;
			background: var(--success);
		}
	}
</style>
