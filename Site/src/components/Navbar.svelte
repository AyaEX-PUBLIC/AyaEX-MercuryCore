<script lang="ts">
	import { slide } from "svelte/transition"
	import { enhance } from "$app/forms"
	import { afterNavigate } from "$app/navigation"
	import { page } from "$app/state"
	import Search from "$components/Search.svelte"
	import User from "$components/User.svelte"

	const { data }: { data: import("../routes/$types").LayoutData } = $props()

	let { user } = $derived(data)

	// units with up to 2 decimals, like the casino (balances are in micro-units), e.g. 1,234.5
	const formatBalance = (micro: number) =>
		(micro / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })

	type Link = {
		name: string
		href: string
		icon: string
		/** Paths, besides href, that count as being on this link's page */
		also?: string[]
	}

	// Places to go on the site...
	let browse: Link[] = $derived([
		{ name: "Home", href: "/home", icon: "fa-house-chimney" },
		{ name: "Games", href: "/games", icon: "fa-mountain-sun", also: ["/place"] },
		{ name: "Catalog", href: "/catalog", icon: "fa-book-open-cover" },
		{ name: "Create", href: "/develop", icon: "fa-hammer", also: ["/games/create"] },
		{ name: "Casino", href: "/casino", icon: "fa-coins" },
		...(data.pages.includes("Groups")
			? [{ name: "Groups", href: "/groups", icon: "fa-people-group" }]
			: []),
		...(data.pages.includes("Forum")
			? [{ name: "Forum", href: "/forum", icon: "fa-messages", also: ["/comment"] }]
			: []),
		{ name: "News", href: "/news", icon: "fa-bullhorn" },
		{ name: "Rules", href: "/rules", icon: "fa-gavel" },
		{ name: "Download", href: "/download", icon: "fa-arrow-down" }
	])

	// ...and your own stuff
	let mine: Link[] = $derived(
		user
			? [
					{ name: "Profile", href: `/user/${user.username}`, icon: "fa-user" },
					{ name: "Character", href: "/character", icon: "fa-user-pen" },
					{
						name: "Friends",
						href: "/requests",
						icon: "fa-user-group",
						also: ["friends", "followers", "following"].map(
							f => `/user/${user.username}/${f}`
						)
					},
					{ name: "Invites", href: "/invites", icon: "fa-envelopes-bulk" },
					{ name: "Inventory", href: "/inventory", icon: "fa-box-open-full" },
					{ name: "Economy", href: "/economy", icon: "fa-money-bill-transfer" },
					{ name: "Notifications", href: "/notifications", icon: "fa-bell" },
					{ name: "Settings", href: "/settings", icon: "fa-gears" },
					...(user.permissionLevel >= 4
						? [{ name: "Admin", href: "/admin", icon: "fa-diamond-half-stroke" }]
						: [])
				]
			: []
	)

	// The link whose path matches the most of the current path
	let current = $derived.by(() => {
		const path = page.url.pathname
		let best = ""
		let length = 0
		for (const link of [...browse, ...mine])
			for (const prefix of [link.href, ...(link.also || [])])
				if (
					(path === prefix || path.startsWith(`${prefix}/`)) &&
					prefix.length > length
				) {
					best = link.href
					length = prefix.length
				}
		return best
	})

	let unread = $derived(data.unreadCount)

	let menu = $state<HTMLElement>()
	afterNavigate(() => menu?.hidePopover())
</script>

<header class="site-header">
	<div class="ctnr bar">
		<a href="/" class="brand">
			<img src="/assets/icon" alt="" class="size-6" />
			<span class="<sm:hidden">{data.siteName}</span>
		</a>

		{#if user}
			<nav aria-label="Main" class="links main-links">
				{#each browse as link}
					<a
						href={link.href}
						aria-current={current === link.href ? "page" : undefined}>
						{link.name}
					</a>
				{/each}
			</nav>

			<div class="ml-auto flex items-center gap-1">
				{#if data.balance !== null && data.balance !== undefined}
					<a
						href="/economy"
						class="balance tooltip"
						aria-label="Your balance">
						<span class="symbol">{data.currencySymbol}</span>
						{formatBalance(data.balance)}
					</a>
				{/if}
				<a
					href="/notifications"
					class="icon-btn tooltip"
					aria-label={unread ? `${unread} unread notifications` : "Notifications"}>
					<fa fa-bell></fa>
					{#if unread}
						<span class="count">{unread > 99 ? "99+" : unread}</span>
					{/if}
				</a>
				<div class="dropdown <lg:hidden">
					<button class="account" aria-label="Account menu">
						<User {user} image size="1.75rem" bg="accent" />
						<span class="<xl:hidden">{user.username}</span>
						<span class="caret" aria-hidden="true"></span>
					</button>
					<div class="dropdown-content">
						<ul>
							<li>
								<a href="/user/{user.username}" class="light-text">
									<fa fa-user></fa>
									Profile
								</a>
							</li>
							<li>
								<a href="/settings" class="light-text">
									<fa fa-gears></fa>
									Settings
								</a>
							</li>
							<li>
								<form use:enhance method="post" action="/api?/logout">
									<button class="btn text-red-400">
										<fa fa-arrow-right-from-bracket></fa>
										Log out
									</button>
								</form>
							</li>
						</ul>
					</div>
				</div>
				<a href="/user/{user.username}" class="lg:hidden pl-1" aria-label="Your profile">
					<User {user} image size="1.75rem" bg="accent" />
				</a>
				<button
					class="icon-btn menu-btn"
					popovertarget="site-menu"
					aria-label="Menu">
					<span class="burger" aria-hidden="true"></span>
				</button>
			</div>
		{:else}
			<div class="ml-auto flex items-center gap-2">
				<a href="/login" class="btn btn-sm btn-quatenary">Log in</a>
				<a href="/register" class="btn btn-sm btn-secondary">
					Register
					<fa fa-arrow-right></fa>
				</a>
			</div>
		{/if}
	</div>
</header>

{#if user}
	<nav aria-label="Your pages" class="subbar <lg:hidden">
		<div class="ctnr flex items-center gap-6">
			<div class="links">
				{#each mine as link}
					<a
						href={link.href}
						aria-current={current === link.href ? "page" : undefined}>
						<fa class={link.icon}></fa>
						{link.name}
					</a>
				{/each}
			</div>
			<Search pages={data.pages} shortcut class="ml-auto max-w-72" />
		</div>
	</nav>

	<nav bind:this={menu} id="site-menu" popover="auto" aria-label="Menu">
		<Search pages={data.pages} class="pb-4" />
		<div class="eyebrow pb-2">Browse</div>
		<div class="grid grid-cols-2 sm:grid-cols-3 tiles">
			{#each browse as link}
				<a
					href={link.href}
					aria-current={current === link.href ? "page" : undefined}>
					<fa class={link.icon}></fa>
					{link.name}
				</a>
			{/each}
		</div>
		<div class="eyebrow pt-5 pb-2">You</div>
		<div class="grid grid-cols-2 sm:grid-cols-3 tiles">
			{#each mine as link}
				<a
					href={link.href}
					aria-current={current === link.href ? "page" : undefined}>
					<fa class={link.icon}></fa>
					{link.name}
				</a>
			{/each}
		</div>
		<form use:enhance method="post" action="/api?/logout" class="pt-5">
			<button class="btn btn-red-tertiary w-full">
				<fa fa-arrow-right-from-bracket></fa>
				Log out
			</button>
		</form>
	</nav>
{/if}

{#if data.banners && user}
	{#each data.banners as banner (banner.id)}
		<div
			transition:slide
			class="banner"
			role="alert"
			style="background: {banner.bgColour}">
			<p class={banner.textLight ? "text-white" : "text-black"}>
				{banner.body}
			</p>
		</div>
	{/each}
{/if}

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 40;
		background: color-mix(in srgb, var(--background) 82%, transparent);
		border-bottom: 1px solid var(--accent2);
		backdrop-filter: blur(12px);
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 2rem;
		height: var(--header-height);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-shrink: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--light-text);
	}

	.links {
		display: flex;
		align-items: center;
		gap: 0.125rem;
		& a {
			position: relative;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.375rem 0.625rem;
			font-size: 0.875rem;
			white-space: nowrap;
			color: var(--grey-text);
			&:hover {
				color: var(--light-text);
			}
			&[aria-current="page"] {
				color: var(--light-text);
			}
		}
	}

	/* the top bar's current page is underlined along the bottom of the header */
	.bar .links {
		align-self: stretch;
		& a {
			height: 100%;
		}
		& a[aria-current="page"]::after {
			content: "";
			position: absolute;
			left: 0.625rem;
			right: 0.625rem;
			bottom: -1px;
			height: 2px;
			background: var(--primary);
		}
	}

	.balance {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		height: 2rem;
		padding: 0 0.625rem;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--light-text);
		border: 1px solid var(--accent2);
		&:hover {
			border-color: var(--accent3);
			color: var(--light-text) !important;
		}
		& .symbol {
			color: var(--success);
		}
	}

	.icon-btn {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		color: var(--grey-text);
		background: none;
		border: 0;
		cursor: pointer;
		&:hover {
			color: var(--light-text) !important;
			background: var(--accent);
		}
	}

	/* scoped styles outrank utility classes, so hide things here */
	@media (min-width: 1024px) {
		.menu-btn {
			display: none;
		}
	}
	@media (max-width: 1023.9px) {
		.main-links {
			display: none;
		}
	}
	.count {
		position: absolute;
		top: 0.2rem;
		right: 0.1rem;
		min-width: 1rem;
		padding: 0 0.2rem;
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 600;
		line-height: 1rem;
		text-align: center;
		color: #fff;
		background: var(--primary);
	}

	.account {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		height: 2.25rem;
		padding: 0 0.5rem 0 0.25rem;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--light-text);
		background: none;
		border: 1px solid transparent;
		cursor: pointer;
		&:hover {
			border-color: var(--accent2);
		}
	}

	.caret {
		width: 0.375rem;
		height: 0.375rem;
		border-right: 1.5px solid var(--grey-text);
		border-bottom: 1.5px solid var(--grey-text);
		rotate: 45deg;
		translate: 0 -0.125rem;
	}

	.burger,
	.burger::before,
	.burger::after {
		display: block;
		width: 1rem;
		height: 1.5px;
		background: currentColor;
	}
	.burger {
		position: relative;
		&::before,
		&::after {
			content: "";
			position: absolute;
			left: 0;
		}
		&::before {
			top: -5px;
		}
		&::after {
			top: 5px;
		}
	}

	.subbar {
		background: var(--darker);
		border-bottom: 1px solid var(--accent2);
		& > div {
			height: 2.75rem;
		}
		& .links {
			margin-left: -0.625rem;
		}
		& .links a {
			font-size: 0.8125rem;
			&[aria-current="page"] {
				background: var(--accent);
			}
		}
		& fa {
			font-size: 0.75rem;
			opacity: 0.7;
		}
	}

	#site-menu {
		position: fixed;
		inset: var(--header-height) 0 auto 0;
		width: 100%;
		max-width: none;
		max-height: calc(100dvh - var(--header-height));
		margin: 0;
		padding: 1.25rem;
		border-width: 0 0 1px;
		& .tiles a {
			display: flex;
			align-items: center;
			gap: 0.625rem;
			padding: 0.875rem 1rem;
			font-size: 0.875rem;
			color: var(--light-text);
			&[aria-current="page"] {
				background: var(--accent);
			}
		}
		& fa {
			width: 1rem;
			color: var(--grey-text);
		}
	}

	.banner {
		padding: 0.4rem 1rem;
		text-align: center;
		font-size: 0.875rem;
		& p {
			padding: 0;
		}
	}
</style>
