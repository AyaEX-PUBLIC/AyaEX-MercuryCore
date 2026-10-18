<script lang="ts">
	import { applyAction, enhance } from "$app/forms"
	import { invalidateAll } from "$app/navigation"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Comment from "$components/Comment.svelte"
	import Head from "$components/Head.svelte"
	import PostReply from "$components/PostReply.svelte"
	import User from "$components/User.svelte"
	import types from "$lib/assetTypes"
	import { superForm } from "$lib/validate"
	import { likeForm } from "../../../like.remote"

	let replyingTo = $state("")
	let commentsCollapsed = $state({})

	const { data, form } = $props()

	let { user } = $derived(data)
	let fee = $derived((data.currentFee * data.asset.price).toFixed(2))
	let totalPrice = $derived((1 + data.currentFee) * data.asset.price)
	let itsFree = $derived(data.asset.price === 0) // IT'S FREEEEEEEEEEEEEE

	let regenerating = $state(false)

	const enhanceRegen: import("./$types").SubmitFunction = () => {
		regenerating = true
		return async ({ result }) => {
			if (result.type === "success") await invalidateAll()
			await applyAction(result)
			regenerating = false
		}
	}

	let comments = $derived(data.asset.comments)

	let formData = $derived(superForm(data.form))
</script>

<Head name={data.siteName} title={data.asset.name} />

<div class="ctnr max-w-260">
	<div class="pb-4">
		<Breadcrumbs path={[["Catalog", "/catalog"]]} final={data.asset.name} />
	</div>

	<div class="panel md:grid! grid-cols-[minmax(0,2fr)_minmax(0,3fr)] mb-8">
		<div class="preview md:line-r <md:line-b">
			<img
				class={["transition-opacity duration-300", { "opacity-50": regenerating }]}
				src={form?.icon ||
					`/catalog/${data.asset.id}/${data.slug}/icon`}
				alt={data.asset.name} />
		</div>

		<div class="flex flex-col">
			<div class="p-5 pb-6 flex flex-col gap-4">
				<div class="flex items-center gap-2">
					<span class="badge">{types[data.asset.type]}</span>
					{#if data.asset.owned}
						<span class="badge badge-success">
							<fa fa-check></fa>
							Owned
						</span>
					{/if}
					<span class="ml-auto flex items-center">
						{#if data.asset.isCreator || user.permissionLevel >= 4}
							<a
								aria-label="Asset settings"
								href="/catalog/{data.asset.id}/{data.slug}/settings"
								class="btn btn-sm btn-quatenary tooltip px-2">
								<fa fa-sliders></fa>
							</a>
						{/if}
						{#if user.permissionLevel >= 5 && [8, 11, 12].includes(data.asset.type)}
							<span class="dropdown">
								<fa fa-ellipsis-h class="dropdown-ellipsis"></fa>
								<div class="dropdown-content">
									<ul>
										<li>
											<form
												use:enhance={enhanceRegen}
												method="post"
												action="?/rerender">
												<button class="btn accent-text">
													<fa fa-arrows-rotate></fa>
													Rerender
												</button>
											</form>
										</li>
									</ul>
								</div>
							</span>
						{/if}
					</span>
				</div>

				<div>
					<h1 class="text-3xl break-words">{data.asset.name}</h1>
					{#if data.asset.creator}
						<span class="flex items-center gap-2 pt-3 text-sm grey-text">
							by
							<User
								user={data.asset.creator}
								size="1.5rem"
								full
								thin
								bg="accent" />
						</span>
					{/if}
				</div>

				<p class="grey-text whitespace-pre-line break-words p-0">
					{data.asset.description || "No description available."}
				</p>
			</div>

			<dl class="kv line-t mt-auto">
				<div>
					<dt>Sold</dt>
					<dd>{data.asset.sold}</dd>
				</div>
				{#if data.asset.forSale && !itsFree}
					<div>
						<dt>Price</dt>
						<dd class="mono text-emerald-400">
							{data.currencySymbol}{data.asset.price}
						</dd>
					</div>
					<div>
						<dt>Fee</dt>
						<dd class="mono text-amber-400">
							{data.currencySymbol}{fee}
						</dd>
					</div>
				{/if}
			</dl>

			<div class="p-5 line-t">
				{#if !data.asset.forSale}
					<button class="btn btn-lg btn-tertiary w-full" disabled>
						Not for sale
					</button>
				{:else if data.asset.owned}
					<button class="btn btn-lg btn-tertiary w-full" disabled>
						<fa fa-check></fa>
						You own this item
					</button>
				{:else}
					<button popovertarget="buy" class="btn btn-lg btn-primary w-full">
						{#if itsFree}
							Get it for free
						{:else}
							Buy for {data.currencySymbol}{totalPrice}
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>

	<section class={{ "pb-32": comments.length > 0 }}>
		<h2 class="text-lg pb-4 mb-4 line-b">
			Comments
			<span class="dim-text font-400">{comments.length}</span>
		</h2>
		<PostReply {formData} />
		{#if comments.length > 0}
			{#each comments as _, num}
				<Comment
					{likeForm}
					comment={comments[num]}
					{num}
					bind:commentsCollapsed
					bind:replyingTo
					{user} />
			{/each}
		{:else}
			<div class="empty mt-4">
				<b>No comments yet</b>
				<p>Be the first to post one!</p>
			</div>
		{/if}
	</section>
</div>

<div id="buy" class="buy" popover="auto">
	{#if data.balance >= totalPrice}
		<div class="eyebrow pb-2">{itsFree ? "Get item" : "Purchase"}</div>
		<h3 class="text-xl pb-2">{data.asset.name}</h3>
		<p class="grey-text">
			Would you like to {itsFree ? "get" : "buy"}
			{data.asset.name} for
			{#if itsFree}
				<strong class="light-text">free</strong>?
			{:else}
				<strong class="light-text mono">
					{data.currencySymbol}{totalPrice}</strong
				>?
			{/if}
		</p>

		<div class="flex gap-2 pt-2">
			<form method="post" action="?/buy">
				<button class="btn btn-primary">
					{itsFree ? "Get" : "Buy now"}
				</button>
			</form>
			<button
				popovertarget="buy"
				popovertargetaction="hide"
				class="btn btn-tertiary">
				{data.noText}
			</button>
		</div>
	{:else}
		<div class="eyebrow pb-2">Purchase</div>
		<h3 class="text-xl pb-2">Insufficient funds</h3>
		<p class="grey-text">
			You don't have enough {data.currencySymbol} to buy this item. You'll
			need <strong class="light-text mono">{totalPrice - data.balance}</strong>
			more.
		</p>

		<button
			popovertarget="buy"
			popovertargetaction="hide"
			class="btn btn-tertiary">
			{data.failText}
		</button>
	{/if}
</div>

<style>
	.preview {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		padding: 10%;
		background-color: var(--darker);
		background-image:
			linear-gradient(45deg, var(--background) 25%, transparent 25%),
			linear-gradient(-45deg, var(--background) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--background) 75%),
			linear-gradient(-45deg, transparent 75%, var(--background) 75%);
		background-size: 24px 24px;
		background-position:
			0 0,
			0 12px,
			12px -12px,
			-12px 0;
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	.buy {
		width: min(26rem, calc(100vw - 2rem));
	}
</style>
