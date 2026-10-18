<script lang="ts">
	// Tabs between a user's friend lists, and your own friend requests

	const {
		username,
		mine,
		current
	}: {
		/** Whose friends, followers and following to link to */
		username: string
		/** Include your friend requests */
		mine: boolean
		current: "requests" | "friends" | "followers" | "following"
	} = $props()

	let links = $derived([
		...(mine ? [["requests", "Requests", "/requests"]] : []),
		["friends", "Friends", `/user/${username}/friends`],
		["followers", "Followers", `/user/${username}/followers`],
		["following", "Following", `/user/${username}/following`]
	])
</script>

<nav class="friends-nav" aria-label="Friends">
	{#each links as [id, name, href]}
		<a {href} aria-current={id === current ? "page" : undefined}>{name}</a>
	{/each}
</nav>

<style>
	.friends-nav {
		display: flex;
		margin-bottom: 1.5rem;
		overflow-x: auto;
		box-shadow: inset 0 -1px 0 var(--accent2);
		& a {
			position: relative;
			padding: 0.625rem 0.875rem;
			font-size: 0.875rem;
			white-space: nowrap;
			color: var(--grey-text);
			&:hover {
				color: var(--light-text);
			}
			&[aria-current="page"] {
				color: var(--light-text);
				&::after {
					content: "";
					position: absolute;
					left: 0;
					right: 0;
					bottom: 0;
					height: 2px;
					background: var(--primary);
				}
			}
		}
	}
</style>
