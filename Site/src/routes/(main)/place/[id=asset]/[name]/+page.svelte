<script lang="ts">
	import { deserialize, enhance } from "$app/forms"
	import { invalidateAll } from "$app/navigation"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import ReportButton from "$components/ReportButton.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import TabNav from "$components/TabNav.svelte"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"
	import { likeEnhance } from "$lib/like"
	import Autopilot from "./Autopilot.svelte"
	import customProtocol from "./customprotocol"
	import Thumbnails from "./Thumbnails.svelte"

	const { data } = $props()

	let { user } = $derived(data)

	let place = $state(data.place)
	let online = $derived(place.serverPing > Date.now() / 1000 - 35)
	let currentPath = $derived(`/place/${place.id}/${data.slug}`)

	const statistics = $derived([
		// ["Activity", "0 visits"],
		["Created", new Date(place.created).toLocaleDateString()],
		["Updated", new Date(place.updated).toLocaleDateString()],
		["Server limit", place.maxPlayers],
		["Now playing", place.players.length]
	])

	// Place Launcher

	type State =
		| "not installed"
		| "waiting"
		| "starting"
		| "ready"
		| "success"
		| "fail"
		| "noplacefile"

	let popover = $state<HTMLDivElement>()
	let closeStatus = $state<"" | "closing" | "closed" | "failed">("")
	let current = $state<State>("not installed")

	function privateFetchParams() {
		const body = new FormData()
		body.append("privateTicket", place.privateTicket)
		return { method: "post", body }
	}

	const launch = (joinscripturl: () => string) => {
		const url = joinscripturl()
		if (url.startsWith("/")) {
			// browser Player, not a launcher protocol
			current = "success"
			window.location.href = url
			return
		}
		customProtocol(
			joinscripturl(),
			() => {
				// this isn't a guarantee that the game has succeeded in launching, but it's a decent guess I guess??
				current = "success"
				setTimeout(() => popover?.hidePopover(), 16000)
			},
			() => {
				current = "not installed"
			}
		)
	}

	// we don't want to start a server if the user is just opening studio to edit the place
	const beginJoining =
		(joinscripturl: () => string, startServer = false) =>
		async () => {
			current = "waiting"

			if (!startServer) {
				launch(joinscripturl)
				return
			}

			try {
				const res = await fetch(`${currentPath}?/start`, privateFetchParams())
				const result = deserialize(await res.text())
				// the action errors before contacting the Orbiter, e.g. with 404
				// when no place file has been uploaded yet, or fails when this
				// user has started servers too often
				if (result.type === "error" || result.type === "failure") {
					current = result.status === 404 ? "noplacefile" : "fail"
					return
				}
			} catch {
				current = "fail"
				return
			}

			const es = new EventSource(`${data.orbiterURL}/${place.id}`)
			es.onmessage = (e: MessageEvent<string>) => {
				const status = e.data
				console.log("EVENTSOURCE", status)
				if (status === "1") current = "starting"
				else if (status === "2") {
					current = "ready"
					launch(joinscripturl)
					es.close()
				} else if (status === "0") {
					current = "fail"
					es.close()
				}
			}
		}

	let loadCommand = $derived(
		`dofile "http://${data.domain}/game/host?ticket=${place.serverTicket}"`
	)

	async function placeLauncher() {
		current = "waiting"

		// Get the joinscript URL
		const response = await fetch(
			`${currentPath}?/join`,
			privateFetchParams()
		)
		const joinScriptData = deserialize(await response.text()) as {
			status: number
			data: { ticket: string }
		}
		if (joinScriptData.status !== 200) return

		// The Aya Player runs in the browser: it fetches the join script itself,
		// authenticated by the session cookie (?/join above registered this
		// session), so no ticket goes in the URL
		const joinScriptUrl = `/game/join/aya?placeId=${place.id}`
		const separator = data.webPlayerURL.includes("?") ? "&" : "?"
		const playerUrl = `${data.webPlayerURL}${separator}joinScriptUrl=${encodeURIComponent(joinScriptUrl)}`
		beginJoining(() => playerUrl, true)()
	}

	const tabs = ["Description", "Servers", "Store", "Badges"]
	const isOwner = data.place.ownerUser?.username === user.username
	if (
		(isOwner || user.permissionLevel === 5) &&
		(data.hosting === "Selfhosted" || data.hosting === "Both")
	)
		tabs.push("Selfhosted")

	let tabData = $state(TabData(data.url, tabs))
	let tabData2 = $state(
		TabData(data.url, ["Manual", "Autopilot"], undefined, "tab2")
	)
	let copiedSuccess = $state(false)

	// Store tab: game passes bought here or in game
	let gamePasses = $state(data.gamePasses)
	let passMessage = $state<{ pass: number; text: string; ok: boolean }>()
	const purchaseText: { [_: string]: string } = {
		Bought: "Purchased! It works in your next game.",
		AlreadyOwned: "You already own this.",
		NotForSale: "This game pass isn't for sale.",
		PriceChanged: "The price changed. Please try again.",
		InsufficientFunds: "You don't have enough currency.",
	}
	const passIcon = (id: number) => `/catalog/${id}/item/icon`
</script>

<Head name={data.siteName} title={place.name} />

<div class="ctnr max-w-300">
	<div class="pb-4">
		<Breadcrumbs path={[["Games", "/games"]]} final={place.name} />
	</div>

	<div class="panel overflow-hidden lg:grid! grid-cols-[minmax(0,5fr)_minmax(19rem,2fr)]">
		<div class="bg-darker lg:line-r <lg:line-b">
			<Thumbnails
				thumbnails={data.thumbnails}
				id={place.id}
				slug={data.slug} />
		</div>

		<div class="flex flex-col">
			<div class="p-5 pb-6 flex flex-col gap-4 flex-1">
				<div class="flex items-center gap-2">
					<span class={["badge", online ? "badge-success" : ""]}>
						<span class={["dot", { on: online }]}></span>
						{online ? "Online" : "Offline"}
					</span>
					<span class="badge">{place.clientVersion}</span>
					<span class="ml-auto flex items-center">
						{#if place.ownerUser?.username === user.username || user.permissionLevel >= 4}
							<a
								aria-label="Place settings"
								href="/place/{place.id}/{data.slug}/settings"
								class="btn btn-sm btn-quatenary tooltip px-2">
								<fa fa-sliders></fa>
							</a>
						{/if}
						<span class="dropdown">
							<fa fa-ellipsis-h class="dropdown-ellipsis"></fa>
							<div class="dropdown-content">
								<ul>
									<ReportButton
										user={place.ownerUser?.username || ""}
										url="/place/{place.id}/{data.slug}" />
								</ul>
							</div>
						</span>
					</span>
				</div>

				<div>
					<h1 class="text-3xl break-words">{place.name}</h1>
					{#if place.ownerUser}
						<span class="flex items-center gap-2 pt-3 text-sm grey-text">
							by
							<User
								user={place.ownerUser}
								size="1.5rem"
								bg="accent"
								full
								thin />
						</span>
					{/if}
				</div>

				<div class="mt-auto flex flex-col gap-4">
					<button
						onclick={placeLauncher}
						class="btn btn-primary btn-lg w-full play"
						popovertarget="ready">
						<img src="/place/join.svg" alt="" class="h-3.5" />
						Play
					</button>

					<form
						use:enhance={likeEnhance(place, p => {
							place = p
						})}
						method="post"
						action="?/like">
						<input
							type="hidden"
							name="privateTicket"
							value={place.privateTicket} />
						<div class="flex items-center gap-3">
							<button
								name="action"
								value={place.likes ? "unlike" : "like"}
								aria-label={place.likes ? "Unlike" : "Like"}
								class={["vote", { liked: place.likes }]}>
								<fa fa-thumbs-up></fa>
								<span>{place.likeCount}</span>
							</button>
							<div class="ratio">
								<div
									class="bg-emerald-400"
									role="progressbar"
									aria-label="Likes"
									style="width: {(place.likeCount /
										(place.dislikeCount + place.likeCount || 1)) *
										100}%"
									aria-valuenow={place.likeCount}
									aria-valuemin={0}
									aria-valuemax={place.dislikeCount +
										place.likeCount}>
								</div>
								<div
									class="bg-red-400"
									role="progressbar"
									aria-label="Dislikes"
									style="width: {(place.dislikeCount /
										(place.dislikeCount + place.likeCount || 1)) *
										100}%"
									aria-valuenow={place.dislikeCount}
									aria-valuemin={0}
									aria-valuemax={place.dislikeCount +
										place.likeCount}>
								</div>
							</div>
							<button
								name="action"
								value={place.dislikes ? "undislike" : "dislike"}
								aria-label={place.dislikes ? "Undislike" : "Dislike"}
								class={["vote", { disliked: place.dislikes }]}>
								<span>{place.dislikeCount}</span>
								<fa fa-thumbs-down></fa>
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>

	<dl class="stats tiles grid grid-cols-2 md:grid-cols-5 mt-6 mb-8">
		{#each statistics as [title, stat]}
			<div>
				<dt class="eyebrow">{title}</dt>
				<dd>{stat}</dd>
			</div>
		{/each}
		<div>
			<dt class="eyebrow">Gear</dt>
			<dd class="grey-text">Not allowed</dd>
		</div>
	</dl>

	<TabNav bind:tabData />

	<Tab bind:tabData>
		{#if place.description}
			<p class="whitespace-pre-line break-words max-w-200">{place.description}</p>
		{:else}
			<p class="grey-text">No description yet.</p>
		{/if}
	</Tab>

	<Tab bind:tabData>
		<div class="panel">
			<div class="panel-head">
				<span>
					Server
					<span class="dim-text">
						&middot; {place.players.length}/{place.maxPlayers} playing
					</span>
				</span>
				<span class={["badge", online ? "badge-success" : ""]}>
					<span class={["dot", { on: online }]}></span>
					{online ? "Online" : "Offline"}
				</span>
			</div>
			<div class="p-4 flex <md:flex-col gap-6">
				<div class="flex flex-col gap-2 md:w-48 shrink-0">
					<button
						onclick={placeLauncher}
						id="join"
						class="btn btn-sm btn-primary"
						popovertarget="ready">
						Join server
					</button>
					{#if isOwner || user.permissionLevel >= 4}
						<form
							use:enhance={() => {
								closeStatus = "closing"
								return async ({ result }) => {
									if (result.type === "success") {
										closeStatus = "closed"
										place.serverPing = 0
										place.players = []
									} else closeStatus = "failed"
								}
							}}
							method="post"
							action="?/close">
							<input
								type="hidden"
								name="privateTicket"
								value={place.privateTicket} />
							<button
								id="close"
								class="btn btn-sm btn-red-secondary w-full"
								disabled={closeStatus === "closing"}>
								{closeStatus === "closing" ? "Closing..." : "Close server"}
							</button>
							{#if closeStatus === "closed"}
								<small class="block pt-1 text-emerald-400">Server closed</small>
							{:else if closeStatus === "failed"}
								<small class="block pt-1 text-red-400">Failed to close the server</small>
							{/if}
						</form>
					{/if}
				</div>
				{#if place.players.length > 0}
					<div class="flex flex-wrap gap-4">
						{#each place.players as user}
							<User {user} size="4.5rem" bg="accent" bottom />
						{/each}
					</div>
				{:else}
					<p class="grey-text text-sm self-center">
						Nobody's playing right now. Press Join to start a server.
					</p>
				{/if}
			</div>
		</div>
	</Tab>

	<Tab bind:tabData>
		{#if gamePasses.length}
			<div class="tiles grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
				{#each gamePasses as pass (pass.id)}
					<div class="p-4 flex flex-col gap-2">
						<img src={passIcon(pass.id)} alt="" class="w-full aspect-square bg-darker" />
						<b class="text-sm">{pass.name}</b>
						{#if pass.description}
							<small class="grey-text">{pass.description}</small>
						{/if}
						<div class="mt-auto pt-2">
							{#if pass.owned}
								<span class="badge badge-success">
									<fa fa-check></fa>
									Owned
								</span>
							{:else}
								<form
									method="post"
									action="?/buypass"
									use:enhance={() =>
										async ({ result }) => {
											const r = result.type === "success" || result.type === "failure"
												? (result.data as { status: string })
												: undefined
											const ok = r?.status === "Bought" || r?.status === "AlreadyOwned"
											if (ok) {
												pass.owned = true
												invalidateAll() // e.g. the balance in the top bar
											}
											passMessage = {
												pass: pass.id,
												ok,
												text: purchaseText[r?.status ?? ""] ?? "The purchase failed. Please try again later.",
											}
										}}>
									<input type="hidden" name="pass" value={pass.id} />
									<input type="hidden" name="price" value={pass.price} />
									<input type="hidden" name="privateTicket" value={place.privateTicket} />
									<button class="btn btn-sm btn-secondary w-full">
										{pass.price ? `Buy for ${data.currencySymbol}${pass.price}` : "Get for free"}
									</button>
								</form>
							{/if}
							{#if passMessage?.pass === pass.id}
								<small class={["block pt-2", passMessage.ok ? "text-emerald-400" : "text-red-400"]}>
									{passMessage.text}
								</small>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty">
				<b>No game passes</b>
				<p>This game has no game passes for sale.</p>
			</div>
		{/if}
	</Tab>

	<Tab bind:tabData>
		{#if data.badges.length}
			<div class="panel">
				{#each data.badges as badge (badge.id)}
					<div class="badge-row">
						<img src={passIcon(badge.id)} alt="" class="size-14 bg-darker shrink-0" />
						<div class="flex-1 min-w-0">
							<b class="text-sm">{badge.name}</b>
							{#if badge.description}
								<p class="grey-text text-sm p-0">{badge.description}</p>
							{/if}
							<small class="eyebrow normal-case tracking-normal">
								Awarded {badge.count} time{badge.count === 1 ? "" : "s"}
							</small>
						</div>
						{#if badge.owned}
							<span class="badge badge-success">
								<fa fa-circle-check></fa>
								Earned
							</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty">
				<b>No badges</b>
				<p>This game has no badges yet.</p>
			</div>
		{/if}
	</Tab>

	{#if tabs.includes("Selfhosted")}
		<Tab bind:tabData>
			<h3 class="pb-3">Hosting on {data.siteName}</h3>
			<p class="grey-text max-w-200">
				To begin hosting your map for everybody to play, you need to
				make sure that you are forwarding the port you wish to run the
				server on. If you are unsure on how to host, there are many
				resources available online on how to port forward on your
				router.
			</p>
			<p class="grey-text max-w-200">
				If you have port forwarded already, it's time to get your server
				running. Below are two methods of hosting &ndash; we recommend
				using Autopilot to get started easily.
			</p>
			<div class="md:flex items-start gap-6 pt-2 mb-4">
				<TabNav bind:tabData={tabData2} vertical class="md:w-40 shrink-0" />
				<Tab bind:tabData={tabData2}>
					<p>
						You can host your server by opening your map in
						<span class="px-1">
							<button
								class="btn btn-sm btn-tertiary"
								onclick={beginJoining(
									() => `${data.scheme}20131+launchmode:ide`
								)}>
								<fa fa-arrow-up-right-from-square></fa>
								Studio
							</button>
						</span>
						and then paste the following command into the command bar:
					</p>
					<div class="flex items-center gap-2">
						<code class="break-all">{loadCommand}</code>
						<button
							onclick={() => {
								navigator.clipboard.writeText(loadCommand)
								copiedSuccess = true
								setTimeout(() => (copiedSuccess = false), 4000)
							}}
							class="btn btn-sm btn-tertiary"
							aria-label="Copy command to clipboard">
							<fa fa-copy></fa>
						</button>
					</div>
					{#if copiedSuccess}
						<small
							id="copiedSuccess"
							transition:fade
							class="block pt-2 text-amber-400">
							Successfully copied command to clipboard
						</small>
					{/if}
				</Tab>
				<Tab bind:tabData={tabData2}>
					<Autopilot
						{beginJoining}
						scheme={data.scheme}
						serverTicket={place.serverTicket}
						domain={data.domain}
						siteName={data.siteName} />
				</Tab>
			</div>
		</Tab>
	{/if}
</div>

<div bind:this={popover} id="ready" popover="auto" class="launcher">
	<div class="flex flex-col items-center text-center gap-5">
		<div class="relative size-16">
			<img
				in:fade={{ duration: 500 }}
				src="/assets/icon"
				alt="{data.siteName} logo"
				class="size-16" />
			{#if current === "waiting" || current === "starting" || current === "ready"}
				<span class="spinner"></span>
			{/if}
		</div>
		<div class="eyebrow">
			{#if current === "success"}
				Have fun!
			{:else if current === "fail" || current === "noplacefile" || current === "not installed"}
				Something went wrong
			{:else}
				Joining
			{/if}
		</div>
		{#if current === "success"}
			<span class="text-xl font-600">
				"{place.name}" is ready to play! Have fun!
			</span>
		{:else if current === "waiting"}
			<span class="text-xl font-600">
				Get ready to join "{place.name}" by {place.ownerUser?.username}!
			</span>
		{:else if current === "starting"}
			<span class="text-xl font-600">
				Starting server for "{place.name}"... This may take a minute.
			</span>
		{:else if current === "ready"}
			<span class="text-xl font-600">
				The server for "{place.name}" is ready! Launching the game...
			</span>
		{:else if current === "noplacefile"}
			<span class="text-xl font-600">
				"{place.name}" doesn't have a place file yet. Upload one in the
				place settings to start a server.
			</span>
		{:else if current === "fail"}
			<span class="text-xl font-600">
				Failed to start the server for "{place.name}". Please try again
				later.
			</span>
		{:else}
			<span class="text-xl font-600">
				Couldn't open the {data.siteName} Player. Please try again.
			</span>
		{/if}
	</div>
</div>

<style>
	.play {
		font-size: 1.0625rem;
		font-weight: 600;
		padding-top: 0.875rem;
		padding-bottom: 0.875rem;
	}

	.vote {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.375rem;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--grey-text);
		background: none;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
		&:hover {
			color: var(--light-text);
			border-color: var(--accent2);
		}
		&.liked {
			color: var(--success);
		}
		&.disliked {
			color: var(--danger);
		}
	}

	.ratio {
		display: flex;
		flex: 1;
		height: 3px;
		background: var(--accent2);
		& div {
			transition: width 0.3s;
		}
	}

	.stats {
		margin-left: 0;
		& > div {
			padding: 0.875rem 1rem;
		}
		& dd {
			margin: 0;
			padding-top: 0.375rem;
			font-weight: 500;
			font-variant-numeric: tabular-nums;
		}
	}

	.badge-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem 1rem;
		& + .badge-row {
			border-top: 1px solid var(--accent2);
		}
	}

	.launcher {
		width: min(28rem, calc(100vw - 2rem));
		padding: 2rem;
	}

	.spinner {
		position: absolute;
		inset: -0.5rem;
		border: 2px solid var(--accent2);
		border-top-color: var(--primary);
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
</style>
