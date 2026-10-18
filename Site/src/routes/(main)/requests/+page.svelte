<script lang="ts">
	import { enhance } from "$app/forms"
	import { page } from "$app/state"
	import FriendsNav from "$components/FriendsNav.svelte"
	import Head from "$components/Head.svelte"
	import Pagination from "$components/Pagination.svelte"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"

	const { data } = $props()
</script>

<Head name={data.siteName} title="Friend requests" />

<div class="ctnr max-w-260">
	<div class="page-head mb-0! border-b-0! pb-6!">
		<div>
			<div class="eyebrow">Social</div>
			<h1>Friends</h1>
			<p>
				{data.users.length > 0
					? `You have ${data.users.length} friend request${data.users.length === 1 ? "" : "s"} waiting.`
					: "People who want to be your friend show up here."}
			</p>
		</div>
	</div>

	<FriendsNav username={data.user.username} mine current="requests" />

	{#if data.users.length > 0}
		<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3">
			{#each data.users as user, num (user.username)}
				<div
					in:fade|global={{ num, total: data.users.length, max: 12 }}
					class="flex items-center gap-4 p-4">
					<User {user} size="3.5rem" bg="accent" />
					<div class="min-w-0 flex-1">
						<a
							class="light-text font-500 block truncate"
							href="/user/{user.username}">
							{user.username}
						</a>
						<div class="flex gap-2 pt-2">
							<form
								use:enhance
								method="post"
								action="/user/{user.username}?/accept">
								<button class="btn btn-sm btn-primary">Accept</button>
							</form>
							<form
								use:enhance
								method="post"
								action="/user/{user.username}?/decline">
								<button class="btn btn-sm btn-tertiary">Decline</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
		{#key page.url}
			<Pagination totalPages={data.pages} />
		{/key}
	{:else}
		<div class="empty">
			<b>No friend requests</b>
			<p>When someone sends you a request, you can accept it here.</p>
		</div>
	{/if}
</div>
