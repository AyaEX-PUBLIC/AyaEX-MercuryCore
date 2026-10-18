<script lang="ts">
	import AdminLink from "$components/AdminLink.svelte"
	import Head from "$components/Head.svelte"

	const { data } = $props()

	const assetTypes = Object.freeze([
		["Shirts", "🧥", "Shirt", "Upload a shirt template to wear on the torso and arms."],
		["T-Shirts", "👕", "T-Shirt", "Turn any picture into a T-shirt."],
		["Pants", "👖", "Pants", "Upload a pants template for the legs."],
		["Decals", "🖼️", "Decal", "Images to put on parts in your places."],
		["Faces", "😏", "Face", "Draw a new face for your character."]
	])
</script>

<Head name={data.siteName} title="Create" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Create</div>
			<h1>Create</h1>
			<p>Build places for everyone to play, and make items to sell in the catalog.</p>
		</div>
	</div>

	<h2 class="text-base pb-3">Places</h2>
	<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3 mb-12">
		<AdminLink
			href="/games/create"
			iconClass="fa-mountain-sun"
			num={0}
			total={2}
			name="New place">
			Start a new place, then upload a place file in its settings.
		</AdminLink>
		<AdminLink
			href="/user/{data.user.username}"
			iconClass="fa-folder-closed"
			num={1}
			total={2}
			name="Your places">
			Your games are listed on your profile.
		</AdminLink>
	</div>

	<h2 class="text-base pb-3">Catalog items</h2>
	<div class="tiles grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
		{#each assetTypes as [name, emoji, type, description], num}
			<AdminLink
				href="/develop/create?asset={type}"
				{emoji}
				{num}
				total={assetTypes.length}
				{name}>
				{description}
			</AdminLink>
		{/each}
	</div>
</div>
