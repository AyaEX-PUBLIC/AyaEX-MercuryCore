<script lang="ts">
	import { enhance } from "$app/forms"
	import User from "$components/User.svelte"
	import fade from "$lib/fade"

	const {
		asset,
		num,
		total
	}: {
		asset: import("./$types").PageData["assets"][0]
		num: number
		total: number
	} = $props()
</script>

<div in:fade|global={{ num, total }} class="flex flex-col">
	<div class="p-3 flex flex-col gap-2">
		<button
			class="preview"
			popovertarget="modal{asset.id}"
			aria-label="Inspect {asset.name}">
			<img
				src="/catalog/{asset.id}/{asset.name}/icon"
				alt={asset.name} />
		</button>
		<span class="text-sm font-500">{asset.name}</span>
		<span class="flex items-center gap-2 text-xs grey-text">
			by
			<User
				user={asset.creator}
				size="1.25rem"
				thin
				full
				bg="accent" />
		</span>
	</div>
	<div class="flex flex-col gap-1.5 p-3 pt-0 mt-auto">
		<form
			use:enhance
			method="post"
			action="/admin/asset?/approve&id={asset.id}">
			<button class="btn btn-sm btn-secondary w-full">Approve</button>
		</form>
		<form
			use:enhance
			method="post"
			action="/admin/asset?/deny&id={asset.id}">
			<button class="btn btn-sm btn-red-secondary w-full">Deny</button>
		</form>
	</div>
</div>

<div
	id="modal{asset.id}"
	class="text-center w-100"
	popover="auto">
	<h2 class="text-base">Asset {asset.name}</h2>
	{#if asset.imageAsset}
		<div class="text-center pb-3">
			<h3 class="text-xs pb-3">Image asset</h3>
			<img
				class="image aspect-1 md:w-80 w-60"
				src="/catalog/{asset.imageAsset.id}/{asset.imageAsset
					.name}/icon"
				alt={asset.imageAsset.name} />
		</div>

		<form
			use:enhance
			method="post"
			action="/admin/asset?/rerender&id={asset.id}"
			class="w-full pb-3">
			<button class="btn btn-lg btn-primary w-full">
				<fa fa-arrows-rotate class="pr-1"></fa>
				Rerender
			</button>
		</form>
		<button
			popovertarget="purge{asset.id}"
			class="btn btn-lg btn-red-tertiary w-full">
			<fa fa-trash-xmark class="pr-1"></fa>
			Purge
		</button>
	{/if}
</div>

<div id="purge{asset.id}" class="max-w-120" popover="auto">
	<h2 class="text-base">Purge {asset.name}</h2>

	<p>Are you sure you want to purge this asset?</p>
	<p>
		<strong>
			This cannot be undone! It will permanently delete the asset, its
			related image asset, and all thumbnails and data associated with it.
		</strong>
		Treat this as a last resort &ndash; the nuclear option.
	</p>

	<div class="flex flex-wrap gap-3">
		<form
			use:enhance
			method="post"
			action="/admin/asset?/purge&id={asset.id}">
			<button class="btn btn-danger">
				Yes, do as I say!
			</button>
		</form>
		<button
			class="btn btn-tertiary"
			popovertarget="purge{asset.id}"
			popovertargetaction="hide">
			Misinput MISINPUT
		</button>
	</div>
</div>

<style>
	.preview {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		padding: 10%;
		background: var(--darker);
		border: 0;
		cursor: zoom-in;
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	.image {
		background: var(--accent);
		background-image: linear-gradient(
				45deg,
				var(--darker) 25%,
				transparent 25%,
				transparent 75%,
				var(--darker) 75%
			),
			linear-gradient(
				45deg,
				var(--darker) 25%,
				transparent 25%,
				transparent 75%,
				var(--darker) 75%
			);
		background-size: 20px 20px;
		background-position:
			0 0,
			10px 10px;
	}
</style>
