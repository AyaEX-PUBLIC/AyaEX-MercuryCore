<script lang="ts">
	import { deserialize, enhance } from "$app/forms"
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
				// the action errors before contacting the Orbiter, e.g. with 404
				// when no place file has been uploaded yet
				if (!res.ok) {
					current = res.status === 404 ? "noplacefile" : "fail"
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

<div class="ctnr max-w-240 light-text">
	<div class="grid grid-cols-1 md:(grid-cols-3 gap-4)">
		<div class="col-span-2 pb-4">
			<Thumbnails
				thumbnails={data.thumbnails}
				id={place.id}
				slug={data.slug} />
		</div>

		<div class="flex flex-col justify-between gap-3">
			<div class="card bg-darker p-4 pb-6 block">
				<div class="flex justify-between">
					<h1 class="text-2xl">{place.name}</h1>
					{#if place.ownerUser?.username === user.username || user.permissionLevel >= 4}
						<div>
							<a
								aria-label="Place settings"
								href="/place/{place.id}/{data.slug}/settings"
								class="btn btn-sm btn-secondary">
								<fa fa-sliders></fa>
							</a>
						</div>
					{/if}
				</div>
				<span class="flex py-2">
					<b class="pr-2">by</b>
					{#if place.ownerUser}
						<User
							user={place.ownerUser}
							size="1.5rem"
							bg="background"
							full
							thin />
					{/if}
				</span>
				<div>
					Gears: <fa fa-circle-xmark></fa>
				</div>
				<small
					class="text-white rounded-2 {online
						? 'bg-emerald-600'
						: 'bg-red-500'} p-2 py-1">
					{online ? "Online" : "Offline"}
				</small>
				<small
					class="text-white rounded-2 bg-purple-600 p-2 py-1">
					{place.clientVersion}
				</small>
				<span class="float-end">
					<span class="dropdown">
						<fa fa-ellipsis-h class="dropdown-ellipsis"></fa>
						<div class="dropdown-content pt-2">
							<ul class="p-2 rounded-3">
								<ReportButton
									user={place.ownerUser?.username || ""}
									url="/place/{place.id}/{data.slug}" />
							</ul>
						</div>
					</span>
				</span>
			</div>
			<div id="buttons" class="flex flex-col">
				<button
					onclick={placeLauncher}
					class="btn btn-primary"
					popovertarget="ready">
					<img
						src="/place/join.svg"
						alt="Play button icon"
						class="h-8" />
				</button>

				<form
					use:enhance={likeEnhance(place, p => {
						place = p
					})}
					method="post"
					action="?/like"
					class="w-full pt-4 px-0 pb-2">
					<input
						type="hidden"
						name="privateTicket"
						value={place.privateTicket} />
					<div class="flex justify-between pb-2">
						<button
							name="action"
							value={place.likes ? "unlike" : "like"}
							aria-label={place.likes ? "Unlike" : "Like"}
							class="btn p-0 px-1 text-emerald-500">
							<fa
								fa-thumbs-up
								class="transition text-lg {place.likes
									? 'text-emerald-600 hover:text-emerald-300'
									: 'text-neutral-600 hover:text-neutral-400'}">
							</fa>
						</button>
						<button
							name="action"
							value={place.dislikes ? "undislike" : "dislike"}
							aria-label={place.dislikes
								? "Undislike"
								: "Dislike"}
							class="btn p-0 px-1 text-red-500">
							<fa
								fa-thumbs-down
								class="transition text-lg {place.dislikes
									? 'text-red-500 hover:text-red-300'
									: 'text-neutral-600 hover:text-neutral-400'}">
							</fa>
						</button>
					</div>
					<div class="flex bg-a2 h-3px">
						<div
							class="bg-emerald-500 transition-width-300"
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
							class="bg-red-500 transition-width-300"
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
					<div class="flex justify-between">
						<span class="px-2">
							{place.likeCount} like{place.likeCount === 1
								? ""
								: "s"}
						</span>
						<span class="px-2">
							{place.dislikeCount} dislike{place.dislikeCount ===
							1
								? ""
								: "s"}
						</span>
					</div>
				</form>
			</div>
		</div>
	</div>

	<TabNav bind:tabData justify />

	<Tab bind:tabData>
		{place.description || ""}
	</Tab>

	<Tab bind:tabData>
		<h4>Server list</h4>
		<!-- {#if online} -->
		<div class="card p-4 flex flex-row">
			<div class="w-1/6">
				<div class="pb-2">
					{place.players.length}/{place.maxPlayers} currently playing
				</div>
				<button
					onclick={placeLauncher}
					id="join"
					class="btn btn-sm btn-primary">
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
						action="?/close"
						class="pt-2">
						<input
							type="hidden"
							name="privateTicket"
							value={place.privateTicket} />
						<button
							id="close"
							class="btn btn-sm btn-red-secondary"
							disabled={closeStatus === "closing"}>
							{closeStatus === "closing" ? "Closing..." : "Close server"}
						</button>
						{#if closeStatus === "closed"}
							<small class="block pt-1 text-emerald-500">Server closed</small>
						{:else if closeStatus === "failed"}
							<small class="block pt-1 text-red-500">Failed to close the server</small>
						{/if}
					</form>
				{/if}
			</div>
			<div class="w-5/6 flex gap-3 h-fit">
				{#each place.players as user}
					<User {user} size="4.5rem" bg="darker" />
				{/each}
			</div>
		</div>
		<!-- {:else}
			This server is offline.
		{/if} -->
	</Tab>

	<Tab bind:tabData>
		<h4>Game passes</h4>
		{#if gamePasses.length}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				{#each gamePasses as pass (pass.id)}
					<div class="card bg-darker p-3 flex flex-col gap-2">
						<img src={passIcon(pass.id)} alt="" class="w-full aspect-square rounded-2" />
						<b>{pass.name}</b>
						{#if pass.description}
							<small class="grey-text">{pass.description}</small>
						{/if}
						{#if pass.owned}
							<span class="text-emerald-500">
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
										if (ok) pass.owned = true
										passMessage = {
											pass: pass.id,
											ok,
											text: purchaseText[r?.status ?? ""] ?? "The purchase failed. Please try again later.",
										}
									}}>
								<input type="hidden" name="pass" value={pass.id} />
								<input type="hidden" name="price" value={pass.price} />
								<input type="hidden" name="privateTicket" value={place.privateTicket} />
								<button class="btn btn-sm btn-primary w-full">
									{pass.price ? `Buy for ${data.currencySymbol}${pass.price}` : "Get for free"}
								</button>
							</form>
						{/if}
						{#if passMessage?.pass === pass.id}
							<small class={passMessage.ok ? "text-emerald-500" : "text-red-500"}>
								{passMessage.text}
							</small>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="grey-text">This game has no game passes for sale.</p>
		{/if}
	</Tab>

	<Tab bind:tabData>
		<h4>Badges</h4>
		{#if data.badges.length}
			<div class="flex flex-col gap-3">
				{#each data.badges as badge (badge.id)}
					<div class="card bg-darker p-3 flex flex-row! gap-4 items-center text-left">
						<img src={passIcon(badge.id)} alt="" class="size-16 rounded-2" />
						<div class="flex-1">
							<b>{badge.name}</b>
							{#if badge.description}
								<p class="grey-text text-sm m-0">{badge.description}</p>
							{/if}
							<small class="grey-text">Awarded {badge.count} time{badge.count === 1 ? "" : "s"}</small>
						</div>
						{#if badge.owned}
							<span class="text-emerald-500">
								<fa fa-circle-check></fa>
								Earned
							</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="grey-text">This game has no badges.</p>
		{/if}
	</Tab>

	{#if tabs.includes("Selfhosted")}
		<Tab bind:tabData>
			<h3 class="pb-2">Hosting on {data.siteName}</h3>
			<p>
				To begin hosting your map for everybody to play, you need to
				make sure that you are forwarding the port you wish to run the
				server on. If you are unsure on how to host, there are many
				resources available online on how to port forward on your
				router.
			</p>
			<p>
				If you have port forwarded already, it's time to get your server
				running. Below are two methods of hosting &ndash; we recommend
				using Autopilot to get started easily.
			</p>
			<div class="flex items-start mb-4">
				<TabNav bind:tabData={tabData2} vertical class="pr-4 pl-0" />
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
					<code class="pr-2">{loadCommand}</code>
					<button
						onclick={() => {
							navigator.clipboard.writeText(loadCommand)
							copiedSuccess = true
							setTimeout(() => (copiedSuccess = false), 4000)
						}}
						class="btn btn-sm btn-secondary py-1.5!"
						aria-label="Copy command to clipboard">
						<fa fa-copy></fa>
					</button>
					{#if copiedSuccess}
						<small
							id="copiedSuccess"
							transition:fade
							class="block text-yellow-500">
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
	<hr />
	<div class="flex justify-around">
		{#each statistics as [title, stat]}
			<div class="text-center">
				<div class="pb-4"><b>{title}</b></div>
				<p>{stat}</p>
			</div>
		{/each}
	</div>
	<hr />
</div>

<div bind:this={popover} id="ready" popover="auto">
	<div class="flex flex-col px-6 pt-6 text-center">
		<div class="self-center size-32 -translate-x-1/2">
			<img
				in:fade={{ duration: 500 }}
				src="/assets/icon"
				alt="{data.siteName} logo"
				class="absolute"
				width="128"
				height="128" />
		</div>
		{#if current === "success"}
			<span class="text-xl pt-6">
				"{place.name}" is ready to play! Have fun!
			</span>
		{:else if current === "waiting"}
			<span class="text-xl pt-6">
				Get ready to join "{place.name}" by {place.ownerUser?.username}!
			</span>
		{:else if current === "starting"}
			<span class="text-xl pt-6">
				Starting server for "{place.name}"... This may take a minute.
			</span>
		{:else if current === "ready"}
			<span class="text-xl pt-6">
				The server for "{place.name}" is ready! Launching the game...
			</span>
		{:else if current === "noplacefile"}
			<span class="text-xl pt-6">
				"{place.name}" doesn't have a place file yet. Upload one in the
				place settings to start a server.
			</span>
		{:else if current === "fail"}
			<span class="text-xl pt-6">
				Failed to start the server for "{place.name}". Please try again
				later.
			</span>
		{:else}
			<span class="text-xl pt-6">
				Couldn't open the {data.siteName} Player. Please try again.
			</span>
		{/if}
	</div>
</div>
