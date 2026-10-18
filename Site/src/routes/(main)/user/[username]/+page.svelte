<script lang="ts">
	import { applyAction, enhance } from "$app/forms"
	import { invalidateAll } from "$app/navigation"
	import Group from "$components/Group.svelte"
	import Head from "$components/Head.svelte"
	import Place from "$components/Place.svelte"
	import ReportButton from "$components/ReportButton.svelte"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"
	import permissionLevels from "$lib/permissionLevels"
	import Interactions from "./Interactions.svelte"

	const { data, form } = $props()

	let { user } = $derived(data)

	let perms = $state(permissionLevels(data.permissionLevel))
	$effect(() => {
		perms = permissionLevels(data.permissionLevel)
	})

	// (for unocss)
	// fa-user fa-check fa-hammer fa-shield-alt fa-scale-balanced

	let regenerating = $state(false)

	const enhanceRegen: import("./$types").SubmitFunction = () => {
		regenerating = true
		return async ({ result }) => {
			if (result.type === "success") await invalidateAll()
			await applyAction(result)
			regenerating = false
		}
	}
</script>

<Head name={data.siteName} title={data.username} />

<div class="ctnr max-w-300">
	<!-- Who they are -->
	<section class="panel mb-6">
		<div class="flex <sm:flex-col gap-5 p-5 sm:items-center">
			<User
				user={data}
				size="6rem"
				bg="accent"
				image
				rerender={{ form, regenerating }} />
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<h1 class="text-3xl break-all">{data.username}</h1>
					<span class="badge" style="color: {perms[0]}">
						<fa class={perms[1]}></fa>
						{perms[2]}
					</span>
					{#if data.follower}
						<span class="badge">Follows you</span>
					{/if}
				</div>
				<div class="flex flex-wrap gap-x-6 gap-y-1 pt-3 text-sm">
					<a href="/user/{data.username}/friends" class="grey-text">
						<b class="light-text mono">{data.friendCount}</b>
						friends
					</a>
					<a href="/user/{data.username}/followers" class="grey-text">
						<b class="light-text mono">{data.followerCount}</b>
						followers
					</a>
					<a href="/user/{data.username}/following" class="grey-text">
						<b class="light-text mono">{data.followingCount}</b>
						following
					</a>
				</div>
			</div>
			<div class="flex items-center gap-2 flex-wrap">
				{#if data.username !== user.username}
					<Interactions {data} />
					<span class="dropdown">
						<fa fa-ellipsis-h class="dropdown-ellipsis"></fa>
						<div class="dropdown-content">
							<ul>
								<ReportButton
									user={data.username}
									url="/user/{data.username}" />
							</ul>
						</div>
					</span>
				{:else}
					<a href="/settings" class="btn btn-tertiary">
						<fa fa-pencil></fa>
						Edit profile
					</a>
					<a href="/character" class="btn btn-tertiary">
						<fa fa-user-pen></fa>
						Character
					</a>
				{/if}
			</div>
		</div>
	</section>

	<div class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] gap-6 items-start">
		<!-- Left: avatar and about -->
		<div class="flex flex-col gap-6">
			<section class="panel">
				<div class="panel-head">
					<span>Avatar</span>
					{#if user?.permissionLevel >= 5}
						<form
							use:enhance={enhanceRegen}
							method="post"
							action="?/rerender">
							<button class="btn btn-sm btn-quatenary normal-case tracking-normal font-sans">
								<fa fa-arrows-rotate></fa>
								Rerender
							</button>
						</form>
					{/if}
				</div>
				<div class="avatar">
					<img
						class={["transition-opacity duration-300", { "opacity-50": regenerating }]}
						src={form?.avatarBody || `/api/avatar/${data.username}-body`}
						alt={data.username} />
				</div>
				{#if form?.msg}
					<small class="block text-red-400 px-4 pb-3">{form.msg}</small>
				{/if}
			</section>

			<section class="panel">
				<div class="panel-head">
					<span>About</span>
					{#if data.username === user.username}
						<a href="/settings" aria-label="Edit description">Edit</a>
					{/if}
				</div>
				<div class="p-4">
					{#if data.description}
						<p class="whitespace-pre-line break-words p-0">{data.description}</p>
					{:else if data.username === user.username}
						<p class="grey-text text-sm p-0">
							Add a description in <a href="/settings">Settings</a>
							to tell others about yourself.
						</p>
					{:else}
						<p class="grey-text text-sm p-0">No description yet.</p>
					{/if}
				</div>
			</section>
		</div>

		<!-- Right: what they've made and done -->
		<div class="flex flex-col gap-6 min-w-0">
			<section>
				<h2 class="section">
					Creations
					<span class="dim-text">{data.places.length}</span>
				</h2>
				{#if data.places.length > 0}
					<div class="tiles grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
						{#each data.places as place, num (place.id)}
							<Place {place} {num} total={data.places.length} />
						{/each}
					</div>
				{:else}
					<p class="grey-text text-sm">No games yet.</p>
				{/if}
			</section>

			{#if data.badges.length > 0}
				<section>
					<h2 class="section">
						Badges
						<span class="dim-text">{data.badges.length}</span>
					</h2>
					<div class="tiles grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6">
						{#each data.badges as badge (badge.id)}
							<a
								href="/place/{badge.place}"
								class="badge-tile light-text"
								title="{badge.name}: {badge.placeName}">
								<img
									src="/catalog/{badge.id}/item/icon"
									alt=""
									class="w-full aspect-square object-contain" />
								<small class="block truncate pt-2">{badge.name}</small>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			{#if data.groupsOwned.length > 0 || data.groups.length > 0}
				<section>
					<h2 class="section">
						Groups
						<span class="dim-text">
							{new Set([...data.groupsOwned, ...data.groups].map(g => g.id)).size}
						</span>
					</h2>
					<div class="tiles grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
						{#each data.groupsOwned as group, num (group.id)}
							<Group {group} {num} total={data.groupsOwned.length} />
						{/each}
						{#each data.groups.filter(g => !data.groupsOwned.some(o => o.id === g.id)) as group, num (group.id)}
							<Group {group} {num} total={data.groups.length} />
						{/each}
					</div>
				</section>
			{/if}

			{#if data.comments.length > 0}
				<section>
					<h2 class="section">Latest posts</h2>
					<div class="panel">
						{#each data.comments.toSorted((a, b) => b.created.getTime() - a.created.getTime()) as comment, num (comment.id)}
							<a
								in:fade={{ num, total: data.comments.length, max: 9 }}
								href="/comment/{comment.id}"
								class="post light-text">
								<time class="eyebrow normal-case tracking-normal">
									{comment.created.toLocaleString()}
								</time>
								<span class="block break-words whitespace-pre-line pt-1">
									{comment.content}
								</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.avatar {
		aspect-ratio: 1;
		background: var(--darker);
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	.section {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding-bottom: 0.75rem;
		font-size: 1.125rem;
		& span {
			font-size: 0.875rem;
			font-weight: 400;
		}
	}

	.badge-tile {
		display: block;
		padding: 0.75rem;
		background: var(--background);
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
	}

	.post {
		display: block;
		padding: 0.875rem 1rem;
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
		& + .post {
			border-top: 1px solid var(--accent2);
		}
	}
</style>
