<script lang="ts">
	import { applyAction, enhance } from "$app/forms"
	import { invalidateAll } from "$app/navigation"
	import Head from "$components/Head.svelte"
	import TabData from "$components/TabData"
	import TabNav from "$components/TabNav.svelte"
	import { brickColours, brickToHex } from "$lib/brickColours"
	import { avatarRigs } from "$lib/rigTypes"
	import AvatarItem from "./AvatarItem.svelte"

	const { data, form } = $props()

	let { user } = $derived(data)

	let regenerating = $state(false)

	const enhanceRegen: import("./$types").SubmitFunction = () => {
		regenerating = true
		return async ({ result }) => {
			// if (result.type === "success") // invalidateAll() anyway, even if the render fails
			await invalidateAll()
			await applyAction(result)
			regenerating = false
		}
	}

	const tabTypes: { [_: string]: number } = Object.freeze({
		Recent: 0,
		Hats: 8,
		Heads: 17,
		Faces: 18,
		"T-Shirts": 2,
		Shirts: 11,
		Pants: 12,
		"Body Parts": 27,
		Gear: 19
	})
	let tabData = $state(TabData(data.url, Object.keys(tabTypes)))

	const bodyParts: { [_: string]: number } = $state({
		Head: user.bodyColours.Head,
		Torso: user.bodyColours.Torso,
		LeftArm: user.bodyColours.LeftArm,
		RightArm: user.bodyColours.RightArm,
		LeftLeg: user.bodyColours.LeftLeg,
		RightLeg: user.bodyColours.RightLeg
	})
	const bodyPartPopovers: { [_: string]: HTMLDivElement } = $state({})
	const styles: { [_: string]: string } = Object.freeze({
		Head: "left-17 size-12",
		Torso: "left-12 top-13 size-22",
		LeftArm: "left-1 top-13 h-22 w-10",
		RightArm: "left-35 top-13 h-22 w-10",
		LeftLeg: "left-12 top-36 h-22 w-10.5",
		RightLeg: "left-23.5 top-36 h-22 w-10.5"
	})

	let assets = $derived(
		data.assets.filter(a =>
			tabData.currentTab === "Recent"
				? true
				: tabTypes[tabData.currentTab] === 27
					? a.type >= 27 && a.type <= 31 // all body part slots
					: a.type === tabTypes[tabData.currentTab]
		)
	)
</script>

<Head name={data.siteName} title="Character" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">Avatar</div>
			<h1>Character</h1>
			<p>Choose what you wear and your body colours. Changes show up the next time you join a game.</p>
		</div>
		<a href="/catalog" class="btn btn-tertiary">
			<fa fa-book-open-cover></fa>
			Shop the catalog
		</a>
	</div>

	<div class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)] gap-6 items-start">
		<div class="grid sm:grid-cols-2 lg:grid-cols-1 gap-6">
			<section class="panel">
				<div class="panel-head">
					<span>Preview</span>
					<form use:enhance={enhanceRegen} method="post" action="?/regen">
						<button class="btn btn-sm btn-quatenary normal-case tracking-normal font-sans">
							<fa fa-rotate></fa>
							Regenerate
						</button>
					</form>
				</div>
				<div class="preview">
					<img
						alt="Your character"
						class={["transition-opacity duration-300", { "opacity-50": regenerating }]}
						src={form?.avatar || `/api/avatar/${user.username}-body`} />
				</div>
				{#if form?.msg}
					<p class="text-red-400 text-sm px-4 pb-3">{form.msg}</p>
				{/if}
				<div class="avatar-type line-t">
					<span class="grey-text text-sm">Avatar type</span>
					<div class="flex">
						{#each avatarRigs as rig}
							<form use:enhance={enhanceRegen} method="post" action="?/rig&rig={rig}">
								<button
									class={["btn btn-sm", (user.avatarRig || "R6") === rig ? "btn-primary" : "btn-tertiary"]}
									aria-pressed={(user.avatarRig || "R6") === rig}
									disabled={regenerating}>
									{rig}
								</button>
							</form>
						{/each}
					</div>
				</div>
				<p class="grey-text text-xs px-4 pb-4">
					Used in games that let players choose. Some games always use R6 or R15.
				</p>
			</section>

			<section class="panel">
				<div class="panel-head">Body colours</div>
				<div class="flex justify-center p-6">
					<div class="relative h-58 w-46">
						{#each Object.keys(bodyParts) as bodyPart}
							<button
								popovertarget={bodyPart}
								style="background-color: #{brickToHex[bodyParts[bodyPart]]}"
								class="bodyPart absolute {styles[bodyPart]}"
								aria-label="Change {bodyPart} colour">
							</button>
						{/each}
					</div>
				</div>
				<p class="grey-text text-xs text-center px-4 pb-4">Click a body part to change its colour.</p>
			</section>
		</div>

		<section class="min-w-0">
			<TabNav bind:tabData />
			{#if assets.length > 0}
				<div class="tiles grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
					{#each assets || [] as asset, num}
						<AvatarItem
							{asset}
							{num}
							total={(assets || []).length}
							currentTab={tabData.currentTab}
							{enhanceRegen} />
					{/each}
				</div>
			{:else if tabData.currentTab === "Recent"}
				<div class="empty">
					<b>No recently worn items</b>
					<p>Items you wear will show up here.</p>
				</div>
			{:else}
				<div class="empty">
					<b>You don't have any {tabData.currentTab} yet</b>
					<p>
						Head to the
						<a href="/catalog?tab={tabData.currentTab}">catalog</a>
						to get some!
					</p>
				</div>
			{/if}
		</section>
	</div>
</div>

{#each Object.keys(bodyParts) as bodyPart}
	<div
		bind:this={bodyPartPopovers[bodyPart]}
		id={bodyPart}
		popover="auto"
		class="colours">
		<div class="eyebrow pb-1">Body colours</div>
		<h2 class="text-lg pb-4">Choose a {bodyPart.replace(/([a-z])([A-Z])/, "$1 $2").toLowerCase()} colour</h2>
		<div class="flex flex-wrap gap-1.5">
			{#each brickColours as colour}
				<form
					use:enhance={enhanceRegen}
					method="post"
					action="?/paint&p={bodyPart}&c={colour}"
					onsubmit={() => {
						bodyParts[bodyPart] = colour
						bodyPartPopovers[bodyPart].hidePopover()
					}}
					class="inline">
					<button
						class={["colour", { current: bodyParts[bodyPart] === colour }]}
						style="background-color: #{brickToHex[colour]}"
						aria-label={colour.toString()}>
					</button>
				</form>
			{/each}
		</div>
	</div>
{/each}

<style>
	.preview {
		aspect-ratio: 1;
		background: var(--darker);
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	.avatar-type {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 1rem 0.5rem;
	}

	.bodyPart {
		padding: 0;
		border: 1px solid rgb(0 0 0 / 0.35);
		cursor: pointer;
		transition:
			filter 0.15s,
			outline-color 0.15s;
		outline: 2px solid transparent;
		outline-offset: 2px;
		&:hover {
			filter: brightness(115%);
			outline-color: var(--light-text);
		}
	}

	.colours {
		width: min(29rem, calc(100vw - 2rem));
	}

	.colour {
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 1px solid rgb(0 0 0 / 0.35);
		cursor: pointer;
		transition: transform 0.1s;
		&:hover {
			transform: scale(1.12);
		}
		&.current {
			outline: 2px solid var(--light-text);
			outline-offset: 2px;
		}
	}
</style>
