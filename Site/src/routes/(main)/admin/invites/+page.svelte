<script lang="ts">
	import { enhance } from "$app/forms"
	import { page } from "$app/state"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import type { TreeNode } from "$lib/server/invites"

	const { data, form } = $props()

	let tabData = $state(
		TabData(
			data.url,
			["Settings", "Applications", "Tree"],
			["fa-sliders", "fa-envelopes-bulk", "fa-user-group"]
		)
	)

	let s = $derived(data.settings)
	let pending = $derived(data.applications.pending)
	let reviewed = $derived(data.applications.reviewed)

	const date = (d: Date | string) => new Date(d).toLocaleDateString()
	const modes = {
		invite: "Invite only: an invite or an accepted application is needed",
		open: "Open: anyone can register",
		closed: "Closed: nobody can register"
	}
	const kinds: { [_: string]: string } = {
		purchase: "bought",
		application: "application"
	}

	/** Everyone under an account, however far down */
	const size = (n: TreeNode): number =>
		n.children.reduce((total, c) => total + 1 + size(c), 0)

	function summary(n: TreeNode) {
		const below = size(n)
		let text = `joined ${date(n.created)}`
		if (n.children.length) text += ` · invited ${n.children.length}`
		if (below > n.children.length) text += `, ${below} below`
		return text
	}

	// accounts nobody invited and who invited nobody go in one list, so the
	// trees above it aren't buried among them
	let trees = $derived(data.tree.filter(n => n.children.length))
	let loners = $derived(data.tree.filter(n => !n.children.length))

	let busy = $state("")
	const submit =
		(name: string) =>
		() => {
			busy = name
			return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
				await update({ reset: false })
				busy = ""
			}
		}

	// moderators can't revoke staff at their level or above
	const canRevoke = (n: TreeNode) =>
		!!data.user &&
		n.username !== data.user.username &&
		(data.canConfigure || n.level < data.user.permissionLevel)
</script>

<Head name={data.siteName} title="Invites - Admin" />

{#snippet node(n: TreeNode)}
	<li>
		<div class="row">
			<a href="/user/{n.username}" class="light-text font-500">{n.username}</a>
			{#if n.via?.kind && kinds[n.via.kind]}
				<span class="badge">{kinds[n.via.kind]}</span>
			{:else if n.via?.discordName}
				<span class="badge" title="Key from the Discord bot">
					Discord: {n.via.discordName}
				</span>
			{/if}
			{#if n.banned}
				<span class="badge badge-danger">Moderated</span>
			{/if}
			{#if n.revoked}
				<span class="badge badge-warning">Invites revoked</span>
			{/if}
			<span class="grey-text text-xs">{summary(n)}</span>
			{#if canRevoke(n)}
				<form method="post" action="?/revoke" use:enhance={submit(n.username)} class="ml-auto">
					<input type="hidden" name="username" value={n.username} />
					<input type="hidden" name="revoked" value={String(!n.revoked)} />
					<button
						class="btn btn-sm btn-tertiary"
						disabled={busy === n.username}
						title={n.revoked
							? "Let them buy invites again"
							: "Stop them buying invites, and disable their unused ones"}>
						<fa class={n.revoked ? "fa-unlock" : "fa-lock"}></fa>
						{n.revoked ? "Restore" : "Revoke"}
					</button>
				</form>
			{/if}
		</div>
		{#if form?.revokedUser === n.username && form.error}
			<p class="text-xs text-red-400 pb-1">{form.error}</p>
		{/if}
		{#if n.children.length}
			<ul>
				{#each n.children as child (child.username)}
					{@render node(child)}
				{/each}
			</ul>
		{/if}
	</li>
{/snippet}

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Invites" />
			<h1>Invites</h1>
			<p>
				Registration is
				<span class={["badge", { "badge-success": s.registration === "open", "badge-danger": s.registration === "closed", "badge-primary": s.registration === "invite" }]}>
					{s.registration === "invite" ? "invite only" : s.registration}
				</span>
				&middot; {data.stats.joined} joined with an invite &middot;
				{data.stats.boughtWeek} bought this week ({data.stats.bought} in all)
			</p>
		</div>
	</div>
</div>

<SidebarShell bind:tabData>
	<Tab bind:tabData>
		<section class="panel">
			<div class="panel-head"><span>Settings</span></div>
			{#if data.canConfigure}
				<form method="post" action="?/settings" use:enhance={submit("settings")} class="p-4">
					<div class="fields">
						<label class="wide">
							<span class="eyebrow">Registration</span>
							<select name="registration">
								{#each Object.entries(modes) as [mode, label]}
									<option value={mode} selected={s.registration === mode}>{label}</option>
								{/each}
							</select>
						</label>
						<label>
							<span class="eyebrow">Invites expire after (days)</span>
							<input name="expiryDays" type="number" min="0" max="365" value={s.expiryDays} />
							<span class="help">Bought and application invites. 0 means never.</span>
						</label>
					</div>

					<h2 class="sub">Buying invites</h2>
					<label class="check">
						<input type="checkbox" name="purchases" checked={s.purchases} />
						Members can buy invites
					</label>
					<div class="fields">
						<label>
							<span class="eyebrow">Price ({data.currencySymbol})</span>
							<input name="price" type="number" min="0" max="1000000" value={s.price} />
						</label>
						<label>
							<span class="eyebrow">Per member, each week</span>
							<input name="perUserWeekly" type="number" min="0" max="100" value={s.perUserWeekly} />
						</label>
						<label>
							<span class="eyebrow">For everyone, each week</span>
							<input name="siteWeekly" type="number" min="0" max="100000" value={s.siteWeekly} />
							<span class="help">0 means no limit. Weeks start Monday, 00:00 UTC.</span>
						</label>
						<label>
							<span class="eyebrow">Account age needed (days)</span>
							<input name="minAccountDays" type="number" min="0" max="3650" value={s.minAccountDays} />
						</label>
					</div>

					<h2 class="sub">Applications</h2>
					<label class="check">
						<input type="checkbox" name="applications" checked={s.applications} />
						People without an invite can apply to join
					</label>
					<div class="fields">
						<label class="wide">
							<span class="eyebrow">Question for applicants</span>
							<input name="question" maxlength="200" required value={s.question} />
						</label>
					</div>

					<h2 class="sub">Tree</h2>
					<label class="check">
						<input type="checkbox" name="treePublic" checked={s.treePublic} />
						Profiles show who invited the account
					</label>

					<p class="grey-text text-xs pt-4">
						Buying invites and applying only work while registration is
						invite only.
					</p>
					<div class="flex flex-wrap items-center gap-3 mt-4">
						<button class="btn btn-primary" disabled={busy === "settings"}>
							<fa fa-floppy-disk></fa>
							Save settings
						</button>
						{#if form?.settingsError}
							<span class="text-sm text-red-400">{form.settingsError}</span>
						{:else if form?.saved}
							<span class="text-sm text-emerald-400">Saved</span>
						{/if}
					</div>
				</form>
			{:else}
				<dl class="kv">
					<div><dt>Registration</dt><dd>{modes[s.registration]}</dd></div>
					<div>
						<dt>Buying invites</dt>
						<dd>
							{s.purchases
								? `${data.currencySymbol}${s.price}, ${s.perUserWeekly} per member a week`
								: "Off"}
						</dd>
					</div>
					<div><dt>Applications</dt><dd>{s.applications ? "On" : "Off"}</dd></div>
				</dl>
				<p class="grey-text text-sm p-4 line-t">
					Only administrators can change these.
				</p>
			{/if}
		</section>
	</Tab>

	<Tab bind:tabData>
		{#if !s.applications || s.registration !== "invite"}
			<p class="notice">
				Nobody can apply right now: applications need to be on and
				registration invite only.
			</p>
		{/if}
		{#if form?.error && !form.revokedUser}
			<p class="notice bad">{form.error}</p>
		{/if}

		<section class="panel">
			<div class="panel-head">
				<span>Waiting for review</span>
				<span>{pending.length}</span>
			</div>
			{#each pending as app (app.id)}
				<form method="post" action="?/review" use:enhance={submit(app.id)} class="app">
					<input type="hidden" name="id" value={app.id} />
					<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<b class="light-text">{app.username}</b>
						<span class="grey-text text-xs">applied {new Date(app.created).toLocaleString()}</span>
						{#if app.contact}
							<span class="text-xs">Contact: {app.contact}</span>
						{/if}
					</div>
					<p class="about">{app.about}</p>
					<div class="flex flex-wrap items-center gap-2">
						<input
							name="note"
							maxlength="500"
							class="note"
							placeholder="Note for the applicant (optional)" />
						<button
							name="decision"
							value="approve"
							class="btn btn-sm btn-success"
							disabled={busy === app.id}>
							<fa fa-check></fa>
							Approve
						</button>
						<button
							name="decision"
							value="reject"
							class="btn btn-sm btn-danger"
							disabled={busy === app.id}>
							<fa fa-ban></fa>
							Reject
						</button>
					</div>
				</form>
			{:else}
				<p class="grey-text text-sm p-4">No applications are waiting.</p>
			{/each}
		</section>

		<section class="panel mt-6">
			<div class="panel-head">
				<span>Reviewed</span>
				<span>Latest {reviewed.length}</span>
			</div>
			{#if reviewed.length}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr>
								<th scope="col">Applicant</th>
								<th scope="col">Decision</th>
								<th scope="col">By</th>
								<th scope="col">Note</th>
							</tr>
						</thead>
						<tbody>
							{#each reviewed as app (app.id)}
								<tr title={app.about}>
									<td>
										{#if app.joined}
											<a href="/user/{app.username}">{app.username}</a>
										{:else}
											{app.username}
										{/if}
									</td>
									<td>
										<span class={["badge", app.status === "approved" ? "badge-success" : "badge-danger"]}>
											{app.status}{app.joined ? ", joined" : ""}
										</span>
									</td>
									<td>
										{app.reviewer || ""}
										<span class="grey-text text-xs">
											{app.reviewed ? date(app.reviewed) : ""}
										</span>
									</td>
									<td class="grey-text">{app.note}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="grey-text text-sm p-4">Nothing reviewed yet.</p>
			{/if}
		</section>
	</Tab>

	<Tab bind:tabData>
		<section class="panel">
			<div class="panel-head">
				<span>Who invited whom</span>
				<span>{trees.length} {trees.length === 1 ? "tree" : "trees"}</span>
			</div>
			<p class="grey-text text-sm px-4 pt-3">
				Revoking stops an account buying invites and disables its unused
				ones. It doesn't touch accounts it already invited.
			</p>
			{#if trees.length}
				<ul class="tree">
					{#each trees as root (root.username)}
						{@render node(root)}
					{/each}
				</ul>
			{:else}
				<p class="grey-text text-sm p-4">Nobody has invited anyone yet.</p>
			{/if}
		</section>

		{#if loners.length}
			<section class="panel mt-6">
				<div class="panel-head">
					<span>No inviter, invited nobody</span>
					<span>{loners.length}</span>
				</div>
				<ul class="tree">
					{#each loners as n (n.username)}
						{@render node(n)}
					{/each}
				</ul>
			</section>
		{/if}
	</Tab>
</SidebarShell>

<style>
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0.875rem 1rem;
		& label {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}
		& .wide {
			grid-column: 1 / -1;
		}
	}

	.help {
		font-size: 0.75rem;
		color: var(--grey-text);
	}

	.sub {
		margin: 1.5rem 0 0.75rem;
		padding-top: 1.25rem;
		font-size: 0.9375rem;
		border-top: 1px solid var(--accent2);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.875rem;
		font-size: 0.875rem;
	}

	.notice {
		margin-bottom: 1.5rem;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		color: var(--grey-text);
		border: 1px solid var(--accent3);
		&.bad {
			color: var(--danger);
			border-color: var(--danger-line);
		}
	}

	.app {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 1rem;
		& + .app {
			border-top: 1px solid var(--accent2);
		}
	}

	.about {
		margin: 0;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		background: var(--darker);
		border-left: 2px solid var(--accent3);
	}

	.note {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.tree {
		margin: 0;
		padding: 0.5rem 1rem 0.75rem;
		list-style: none;
		& ul {
			margin: 0 0 0 0.5rem;
			padding-left: 1rem;
			list-style: none;
			border-left: 1px solid var(--accent3);
		}
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 0.5rem;
		min-height: 2.25rem;
		font-size: 0.875rem;
	}
</style>
