<script lang="ts">
	import { browser } from "$app/environment"
	import { goto } from "$app/navigation"

	const {
		pages,
		shortcut = false,
		class: class_ = ""
	}: {
		pages: string[]
		/** Focus this search box with Ctrl+K */
		shortcut?: boolean
		class?: string
	} = $props()

	let search = $state("")
	let searchFocus = $state(-1)
	$effect(() => {
		if (search === "") searchFocus = -1
	})

	let searchInput = $state<HTMLInputElement>()
	const searchResults: HTMLElement[] = $state([])

	let searchCategories = $derived([
		["Users", "users"],
		["Places", "places"],
		["Catalog", "assets"],
		...(pages.includes("Groups") ? [["Groups", "groups"]] : [])
	])

	function keydown(
		e: KeyboardEvent & {
			currentTarget: EventTarget & HTMLInputElement
		}
	) {
		switch (e.key) {
			case "Enter":
				e.preventDefault()
				searchResults[Math.max(0, searchFocus)].click() // better but not perfect

				searchFocus = -1
				break
			case "ArrowDown":
			case "ArrowUp": {
				e.preventDefault()

				searchFocus += e.key === "ArrowDown" ? 1 : -1
				if (searchFocus >= searchCategories.length) searchFocus = 0
				else if (searchFocus < 0)
					searchFocus = searchCategories.length - 1
				break
			}
			case "Escape":
				search = ""
				searchInput?.blur()
		}
	}
</script>

<svelte:window
	onkeydown={e => {
		// the right way (actually works on different keyboard layouts, lookin at you {insert several docs sites})
		if (!shortcut || !e.ctrlKey || e.key !== "k") return
		e.preventDefault()
		searchInput?.focus()
	}} />

<form action="/search" role="search" class={["search", class_]}>
	<fa fa-magnifying-glass class="icon" aria-hidden="true"></fa>
	<input
		bind:this={searchInput}
		bind:value={search}
		onkeydown={keydown}
		name="q"
		type="search"
		placeholder="Search"
		aria-label="Search"
		autocomplete="off" />
	{#if shortcut && browser}
		<kbd class="hint" aria-hidden="true">Ctrl K</kbd>
	{/if}
	<div class="results">
		{#each searchCategories as [name, value], num}
			<button
				bind:this={searchResults[num]}
				onclick={e => {
					e.preventDefault()
					goto(`/search?q=${encodeURIComponent(search)}&c=${value}`)
					searchInput?.blur()
				}}
				class={{ focused: num === searchFocus }}
				name="c"
				{value}
				title="Search {name}">
				<span class="truncate">
					Search <b>{search}</b>
				</span>
				<span class="eyebrow ml-auto pl-4">{name}</span>
			</button>
		{/each}
	</div>
</form>

<style>
	.search {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}

	.icon {
		position: absolute;
		left: 0.7rem;
		font-size: 0.8125rem;
		color: var(--dim-text);
		pointer-events: none;
	}

	input {
		height: 2rem;
		padding: 0 3.75rem 0 2.1rem !important;
		font-size: 0.8125rem;
		background: var(--darker);
	}

	.hint {
		position: absolute;
		right: 0.4rem;
		pointer-events: none;
		transition: opacity 0.15s;
	}
	input:focus ~ .hint,
	input:not(:placeholder-shown) ~ .hint {
		opacity: 0;
	}

	.results {
		position: absolute;
		top: calc(100% + 0.375rem);
		left: 0;
		right: 0;
		z-index: 30;
		min-width: 16rem;
		padding: 0.25rem;
		background: var(--background);
		border: 1px solid var(--accent2);
		box-shadow: 0 1rem 2rem -0.75rem rgb(0 0 0 / 0.7);
		opacity: 0;
		visibility: hidden;
		translate: 0 -0.25rem;
		transition:
			opacity 0.15s,
			translate 0.15s,
			visibility 0.15s;

		& button {
			display: flex;
			align-items: center;
			width: 100%;
			padding: 0.5rem 0.625rem;
			font: inherit;
			font-size: 0.875rem;
			text-align: start;
			color: var(--light-text);
			background: none;
			border: 0;
			cursor: pointer;
			&:hover,
			&.focused {
				background: var(--accent);
			}
		}
	}

	/* not empty and focussed */
	input:not(:placeholder-shown):focus ~ .results,
	.results:focus-within {
		opacity: 1;
		visibility: visible;
		translate: 0 0;
	}
</style>
