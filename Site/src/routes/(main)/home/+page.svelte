<script lang="ts">
	import Head from "$components/Head.svelte"
	import Shoutbox from "$components/Shoutbox.svelte"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"
	import { encode } from "$lib/urlName"

	const { data } = $props()

	let { user } = $derived(data)

	// people in game first, then online, then everyone else
	const statusOrder = { Playing: 0, Online: 1, Offline: 2 }
	let friends = $derived(
		data.friends.toSorted(
			(a, b) => statusOrder[a.status] - statusOrder[b.status]
		)
	)
	let friendsOnline = $derived(
		data.friends.filter(f => f.status !== "Offline").length
	)

	// the busiest and best liked games
	let games = $derived(
		data.places
			.toSorted(
				(a, b) =>
					b.playerCount - a.playerCount || b.likeCount - a.likeCount
			)
			.slice(0, 6)
	)

	const quickLinks = [
		["Customise character", "/character", "fa-user-pen"],
		["Inventory", "/inventory", "fa-box-open-full"],
		["Friend requests", "/requests", "fa-user-group"],
		["Settings", "/settings", "fa-gears"]
	]
</script>

<Head name={data.siteName} title="Home" />

<div class="ctnr">
	<div
		class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_19rem] items-start">
		<!-- You -->
		<aside class="panel <lg:flex-row!">
			<a
				href="/user/{user.username}"
				class="avatar <lg:w-28 <lg:shrink-0"
				aria-label="Your profile">
				<img src="/api/avatar/{user.username}-body" alt="" />
			</a>
			<div class="flex flex-col min-w-0 flex-1">
				<div class="p-4">
					<div class="eyebrow pb-1.5">Welcome back</div>
					<h1 class="text-2xl break-words">{data.greet}</h1>
				</div>
				<nav class="quick <lg:hidden">
					{#each quickLinks as [name, href, icon]}
						<a {href} class="light-text">
							<fa class={icon}></fa>
							{name}
							<fa fa-arrow-right class="arrow"></fa>
						</a>
					{/each}
				</nav>
				<div class="px-4 pb-4 lg:hidden">
					<a href="/character" class="btn btn-sm btn-tertiary">
						<fa fa-user-pen></fa>
						Customise
					</a>
				</div>
			</div>
		</aside>

		<!-- Shoutbox -->
		{#if data.shoutbox.channels.length > 0}
			{#key data.shoutbox.channel}
				<Shoutbox {user} initial={data.shoutbox} />
			{/key}
		{:else}
			<section class="panel min-w-0">
				<div class="panel-head"><span>Shoutbox</span></div>
				<div class="empty m-4">
					<b>No channels yet</b>
					<p>An administrator can add some in the admin panel.</p>
				</div>
			</section>
		{/if}

		<!-- Friends and games -->
		<aside class="flex flex-col gap-6 lg:col-start-2 xl:col-start-auto">
			<section class="panel">
				<div class="panel-head">
					<span>
						Friends
						{#if data.friends.length > 0}
							<span class="dim-text">
								&middot; {friendsOnline} online
							</span>
						{/if}
					</span>
					<a href="/user/{user.username}/friends">See all</a>
				</div>
				{#if friends.length > 0}
					<div class="grid grid-cols-4 gap-x-2 gap-y-4 p-4">
						{#each friends.slice(0, 12) as friend, num (friend.username)}
							<span
								in:fade|global={{ num, total: friends.length }}
								class="min-w-0">
								<User user={friend} size="100%" bg="accent" bottom />
							</span>
						{/each}
					</div>
				{:else}
					<p class="grey-text text-sm p-4">
						No friends yet. Find people in games, or search for
						them by name.
					</p>
				{/if}
			</section>

			{#if games.length > 0}
				<section class="panel">
					<div class="panel-head">
						<span>Games</span>
						<a href="/games">Browse all</a>
					</div>
					<div class="flex flex-col">
						{#each games as place, num (place.id)}
							{@const slug = encode(place.name)}
							<a
								in:fade|global={{ num, total: games.length }}
								href="/place/{place.id}/{slug}"
								class="game light-text">
								<img
									src="/place/{place.id}/{slug}/icon"
									alt=""
									loading="lazy" />
								<span class="min-w-0 flex-1">
									<span class="block text-sm font-500 truncate">
										{place.name}
									</span>
									<span class="eyebrow normal-case tracking-normal">
										<fa fa-user></fa>
										{place.playerCount} playing
									</span>
								</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		</aside>
	</div>
</div>

<style>
	.avatar {
		display: block;
		aspect-ratio: 1;
		background: var(--darker);
		border-bottom: 1px solid var(--accent2);
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
			transition: scale 0.3s;
		}
		&:hover img {
			scale: 1.04;
		}
		@media (max-width: 1023.9px) {
			border-bottom: 0;
			border-right: 1px solid var(--accent2);
		}
	}

	.quick {
		border-top: 1px solid var(--accent2);
		& a {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.625rem 1rem;
			font-size: 0.875rem;
			transition: background-color 0.15s;
			&:hover {
				background: var(--accent);
				& .arrow {
					opacity: 1;
				}
			}
			& + a {
				border-top: 1px solid var(--accent2);
			}
		}
		& fa {
			width: 1rem;
			font-size: 0.8125rem;
			color: var(--grey-text);
		}
		& .arrow {
			margin-left: auto;
			font-size: 0.6875rem;
			opacity: 0;
			transition: opacity 0.15s;
		}
	}

	.game {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 1rem;
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
		& + .game {
			border-top: 1px solid var(--accent2);
		}
		& img {
			width: 2.75rem;
			height: 2.75rem;
			object-fit: cover;
			background: var(--darker);
			border: 1px solid var(--accent2);
		}
		& fa {
			font-size: 0.625rem;
			padding-right: 0.125rem;
		}
	}
</style>
