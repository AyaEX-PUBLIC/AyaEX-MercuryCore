<script lang="ts">
	import { enhance } from "$app/forms"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import Identicon from "$components/Identicon.svelte"
	import User from "$components/User.svelte"

	const { data, form } = $props()

	const modeLabels = { open: "Open", invite: "Invite only", closed: "Closed" } as const
	let inviteName = $state("")
</script>

<Head name={data.siteName} title={data.name} />

<div class="ctnr max-w-260">
	<div class="pb-4">
		<Breadcrumbs path={[["Groups", "/groups"]]} final={data.name} />
	</div>

	<section class="panel">
		<div class="flex <sm:flex-col gap-5 p-5 sm:items-center">
			<div class="mark">
				<Identicon name={data.name} />
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="text-3xl break-words">{data.name}</h1>
					<span
						class={[
							"badge",
							{
								"badge-success": data.joinMode === "open",
								"badge-warning": data.joinMode === "invite",
								"badge-danger": data.joinMode === "closed"
							}
						]}>
						{modeLabels[data.joinMode]}
					</span>
				</div>
				<div class="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 text-sm grey-text">
					<span class="flex items-center gap-2">
						by
						<User user={data.owner} full thin bg="accent" size="1.5rem" />
					</span>
					<a href="/groups/{data.id}/members" class="grey-text">
						<b class="light-text mono">{data.memberCount}</b>
						member{data.memberCount === 1 ? "" : "s"}
					</a>
				</div>
			</div>
			<div class="flex gap-2 items-center flex-wrap">
				{#if data.in}
					{#if !data.owned}
						<form use:enhance method="post" action="?/leave">
							<button class="btn btn-red-secondary">Leave group</button>
						</form>
					{:else}
						<span class="badge badge-primary">You own this group</span>
					{/if}
				{:else if data.invited}
					<span class="grey-text text-sm">You're invited</span>
					<form use:enhance method="post" action="?/join">
						<button class="btn btn-primary">Accept invite</button>
					</form>
					<form use:enhance method="post" action="?/decline">
						<button class="btn btn-tertiary">Decline</button>
					</form>
				{:else if data.joinMode === "open"}
					<form use:enhance method="post" action="?/join">
						<button class="btn btn-primary">Join group</button>
					</form>
				{:else}
					<button class="btn btn-tertiary" disabled>
						{data.joinMode === "invite" ? "Invite only" : "Not accepting members"}
					</button>
				{/if}
			</div>
		</div>
		<div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 line-t text-sm">
			<span class="grey-text">
				In game: <code>player:IsInGroup({data.engineGroupId})</code>
			</span>
			{#if form?.msg && !data.canManage}
				<span class="text-amber-400">{form.msg}</span>
			{/if}
		</div>
	</section>

	{#if data.canManage && data.manage}
		<section class="panel mt-6">
			<div class="panel-head">Manage group</div>
			<div class="p-5 flex flex-col gap-8">
				{#if form?.msg}
					<p class="alert p-3!">{form.msg}</p>
				{/if}

				<form use:enhance method="post" action="?/settings" class="flex flex-col gap-3">
					<h3 class="text-base">Who can join</h3>
					{#each Object.entries(data.joinModes) as [mode, label]}
						<label class="flex gap-3 items-center font-400 cursor-pointer">
							<input type="radio" name="joinMode" value={mode} checked={data.joinMode === mode} />
							{label}
						</label>
					{/each}
					<button class="btn btn-sm btn-primary self-start mt-1">Save</button>
				</form>

				<div class="flex flex-col gap-3 pt-6 line-t">
					<h3 class="text-base">Invite someone</h3>
					<form
						use:enhance={() =>
							async ({ update, result }) => {
								await update()
								if (result.type === "success") inviteName = ""
							}}
						method="post"
						action="?/invite"
						class="input-group max-w-120">
						<input name="username" bind:value={inviteName} placeholder="Username" required aria-label="Username to invite" />
						<button class="btn btn-primary">Invite</button>
					</form>
					{#if data.manage.invites.length}
						<table class="w-full">
							<thead>
								<tr><th>Invited</th><th>By</th><th>When</th><th></th></tr>
							</thead>
							<tbody>
								{#each data.manage.invites as invite (invite.username)}
									<tr>
										<td><User user={invite} full thin bg="accent" size="1.6rem" /></td>
										<td>{invite.inviter}</td>
										<td class="mono grey-text text-xs">{new Date(invite.created).toLocaleString()}</td>
										<td class="text-right">
											<form use:enhance method="post" action="?/revoke">
												<input type="hidden" name="username" value={invite.username} />
												<button class="btn btn-sm btn-red-tertiary">Revoke</button>
											</form>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<span class="grey-text text-sm">No pending invites</span>
					{/if}
				</div>

				<div class="flex flex-col gap-3 pt-6 line-t">
					<h3 class="text-base">
						Members
						<span class="dim-text font-400">{data.manage.members.length}</span>
					</h3>
					<table class="w-full">
						<tbody>
							{#each data.manage.members as member (member.username)}
								<tr>
									<td><User user={member} full thin bg="accent" size="1.6rem" /></td>
									<td class="text-right">
										{#if member.username === data.owner.username}
											<span class="badge">Owner</span>
										{:else}
											<form use:enhance method="post" action="?/kick">
												<input type="hidden" name="username" value={member.username} />
												<button class="btn btn-sm btn-red-tertiary">Remove</button>
											</form>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.mark {
		width: 6rem;
		height: 6rem;
		padding: 0.75rem;
		flex-shrink: 0;
		background: var(--darker);
		border: 1px solid var(--accent2);
	}

	td {
		vertical-align: middle;
	}
</style>
