<script lang="ts">
	// A user row, used on friend, follower and group member lists

	import User from "$components/User.svelte"
	import fade from "$lib/fade"

	const {
		user,
		num,
		total
	}: {
		user: BasicUser
		num: number
		total: number
	} = $props()
</script>

<a
	in:fade|global={{ num, total, max: 12 }}
	class="usercard light-text"
	href="/user/{user.username}">
	<User {user} image size="3rem" bg="accent" />
	<span class="min-w-0">
		<span class="block font-500 truncate">{user.username}</span>
		<span class="eyebrow block">{user.status || "Offline"}</span>
	</span>
</a>

<style>
	.usercard {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		height: 100%;
		padding: 0.875rem 1rem;
		background: var(--background);
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
	}
</style>
