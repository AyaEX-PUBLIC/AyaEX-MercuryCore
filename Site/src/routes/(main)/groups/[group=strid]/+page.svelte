<script lang="ts">
	import { enhance } from "$app/forms"
	import Head from "$components/Head.svelte"
	import User from "$components/User.svelte"

	const { data, form } = $props()

	const modeLabels = { open: "Open", invite: "Invite only", closed: "Closed" } as const
	let inviteName = $state("")
</script>

<Head name={data.siteName} title={data.name} />

<div class="ctnr max-w-240">
	<div class="px-6">
		<h1>{data.name}</h1>
		<div class="flex items-center gap-3 flex-wrap">
			<b>by</b>
			<User user={data.owner} full thin bg="accent" size="1.5rem" />
			<span class="badge {data.joinMode}">{modeLabels[data.joinMode]}</span>
		</div>
		<div class="flex pt-6 justify-between items-center gap-4 flex-wrap">
			<a
				href="/groups/{data.id}/members"
				class="light-text text-center no-underline pl-6">
				Members
				<h3 class="light-text">
					{data.memberCount}
				</h3>
			</a>
			<div class="flex gap-2 items-center">
				{#if data.in}
					{#if !data.owned}
						<form use:enhance method="post" action="?/leave">
							<button class="btn btn-red-secondary">Leave</button>
						</form>
					{/if}
				{:else if data.invited}
					<span class="grey-text">You're invited</span>
					<form use:enhance method="post" action="?/join">
						<button class="btn btn-primary">Accept invite</button>
					</form>
					<form use:enhance method="post" action="?/decline">
						<button class="btn btn-secondary">Decline</button>
					</form>
				{:else if data.joinMode === "open"}
					<form use:enhance method="post" action="?/join">
						<button class="btn btn-primary">Join</button>
					</form>
				{:else}
					<button class="btn btn-secondary" disabled>
						{data.joinMode === "invite" ? "Invite only" : "Not accepting members"}
					</button>
				{/if}
			</div>
		</div>
		{#if form?.msg && !data.canManage}
			<p class="text-yellow-500 pt-2 text-right">{form.msg}</p>
		{/if}
		<p class="grey-text text-sm pt-4">
			In game: <code>player:IsInGroup({data.engineGroupId})</code>
		</p>
	</div>

	{#if data.canManage && data.manage}
		<div class="card bg-darker p-4 mt-8 flex flex-col gap-6">
			<h2 class="text-xl">Group settings</h2>
			{#if form?.msg}
				<p class="text-yellow-500">{form.msg}</p>
			{/if}

			<form use:enhance method="post" action="?/settings" class="flex flex-col gap-2">
				<b>Who can join</b>
				{#each Object.entries(data.joinModes) as [mode, label]}
					<label class="flex gap-2 items-center">
						<input type="radio" name="joinMode" value={mode} checked={data.joinMode === mode} />
						{label}
					</label>
				{/each}
				<button class="btn btn-primary self-start">Save</button>
			</form>

			<div class="flex flex-col gap-2">
				<b>Invite someone</b>
				<form
					use:enhance={() =>
						async ({ update, result }) => {
							await update()
							if (result.type === "success") inviteName = ""
						}}
					method="post"
					action="?/invite"
					class="flex gap-2">
					<input name="username" bind:value={inviteName} placeholder="Username" required class="grow min-w-0" />
					<button class="btn btn-primary">Invite</button>
				</form>
				{#if data.manage.invites.length}
					<table class="w-full text-sm">
						<thead>
							<tr class="text-left"><th>Invited</th><th>By</th><th>When</th><th></th></tr>
						</thead>
						<tbody>
							{#each data.manage.invites as invite (invite.username)}
								<tr>
									<td class="py-1"><User user={invite} full thin bg="accent" size="1.6rem" /></td>
									<td>{invite.inviter}</td>
									<td>{new Date(invite.created).toLocaleString()}</td>
									<td class="text-right">
										<form use:enhance method="post" action="?/revoke">
											<input type="hidden" name="username" value={invite.username} />
											<button class="btn btn-sm btn-red-secondary">Revoke</button>
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

			<div class="flex flex-col gap-2">
				<b>Members ({data.manage.members.length})</b>
				<table class="w-full text-sm">
					<tbody>
						{#each data.manage.members as member (member.username)}
							<tr>
								<td class="py-1"><User user={member} full thin bg="accent" size="1.6rem" /></td>
								<td class="text-right">
									{#if member.username === data.owner.username}
										<span class="grey-text">Owner</span>
									{:else}
										<form use:enhance method="post" action="?/kick">
											<input type="hidden" name="username" value={member.username} />
											<button class="btn btn-sm btn-red-secondary">Remove</button>
										</form>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.badge {
		padding: 0.1rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 600;
		background: rgb(34 197 94 / 0.15);
		color: #4ade80;
	}
	.badge.invite {
		background: rgb(234 179 8 / 0.15);
		color: #facc15;
	}
	.badge.closed {
		background: rgb(239 68 68 / 0.15);
		color: #f87171;
	}
	tbody tr:nth-child(2n-1) {
		background: var(--background);
	}
</style>
