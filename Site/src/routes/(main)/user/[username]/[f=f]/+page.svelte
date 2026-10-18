<script lang="ts">
	// The friends, followers, and following pages for a user.

	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import FriendsNav from "$components/FriendsNav.svelte"
	import Head from "$components/Head.svelte"
	import UserCard from "$components/UserCard.svelte"

	const { data } = $props()

	const titles = Object.freeze({
		friends: () => `${data.username}'s friends`,
		followers: () => `${data.username}'s followers`,
		following: () => `Followed by ${data.username}`
	})
	let title = $derived(titles[data.f]())
	let mine = $derived(data.username === data.user.username)
</script>

<Head name={data.siteName} {title} />

<div class="ctnr max-w-260">
	<div class="pb-4">
		<Breadcrumbs
			path={[[data.username, `/user/${data.username}`]]}
			final={data.f} />
	</div>
	<h1 class="pb-6">
		{title}
		<span class="dim-text font-400">{data.count}</span>
	</h1>

	<FriendsNav username={data.username} {mine} current={data.f} />

	{#if data.users.length > 0}
		<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3">
			{#each data.users as user, num (user.username)}
				<UserCard {user} {num} total={data.users.length} />
			{/each}
		</div>
	{:else}
		<div class="empty">
			<b>Nobody here yet</b>
		</div>
	{/if}
</div>
