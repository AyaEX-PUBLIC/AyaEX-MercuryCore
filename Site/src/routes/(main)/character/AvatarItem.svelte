<script lang="ts">
	// An equippable avatar item component

	import { enhance } from "$app/forms"
	import fade from "$lib/fade"

	const {
		asset,
		num,
		total,
		currentTab,
		enhanceRegen
	}: {
		asset: {
			name: string
			id: number
			wearing: boolean
		}
		num: number
		total: number
		currentTab: string
		enhanceRegen: import("./$types").SubmitFunction
	} = $props()
</script>

<form
	use:enhance={enhanceRegen}
	method="post"
	action="/character?/{asset.wearing
		? 'un'
		: ''}equip&tab={currentTab}&id={asset.id}">
	<button
		in:fade|global={{ num, total }}
		class={["item", { wearing: asset.wearing }]}
		title={asset.wearing ? `Take off ${asset.name}` : `Wear ${asset.name}`}>
		{#if asset.wearing}
			<span class="badge badge-primary tag">
				<fa fa-check></fa>
				Wearing
			</span>
		{/if}
		<span class="thumb">
			<img src="/catalog/{asset.id}/{asset.name}/icon" alt="" loading="lazy" />
		</span>
		<span class="name">{asset.name}</span>
	</button>
</form>

<style>
	form {
		height: 100%;
	}

	.item {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		padding: 0 0 0.75rem;
		font: inherit;
		text-align: left;
		color: var(--light-text);
		background: var(--background);
		border: 0;
		cursor: pointer;
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
		&.wearing {
			background: var(--primary-soft);
			box-shadow: inset 0 0 0 1px var(--primary-line);
		}
	}

	.tag {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
	}

	.thumb {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		padding: 14%;
		& img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	.name {
		padding: 0 0.75rem;
		font-size: 0.875rem;
		line-height: 1.3;
	}
</style>
