<script lang="ts">
	import type { ClassValue } from "svelte/elements"

	let {
		tabData = $bindable(),
		justify = false,
		vertical = false,
		class: class_ = ""
	}: {
		tabData: {
			name: string
			tabs: string[]
			currentTab: string
			url: string
			icons?: string[]
			num: number
		}
		justify?: boolean
		/** A column of tabs (a row that scrolls sideways on small screens) */
		vertical?: boolean
		class?: ClassValue
	} = $props()

	// prevents nested tabs from breaking
	$effect(() => {
		tabData.num = 0
	})

	function href(tab: string) {
		const search = new URL(tabData.url).searchParams
		search.set(tabData.name, tab)
		return `?${search}`
	}
</script>

<ul
	class={["tabnav", vertical ? "vertical" : "horizontal", class_, { justified: justify }]}
	role="tablist">
	{#each tabData.tabs as tab, pos}
		<li data-sveltekit-preload-data="off">
			<a
				href={href(tab)}
				role="tab"
				aria-selected={tabData.currentTab === tab}
				onclick={e => {
					e.preventDefault()
					tabData.currentTab = tab
				}}>
				{#if tabData.icons?.[pos]}
					<fa class={tabData.icons[pos]}></fa>
				{/if}
				{tab}
			</a>
		</li>
	{/each}
</ul>

<style>
	.tabnav {
		display: flex;
		list-style: none;
		margin: 0;
		padding: 0;
		min-width: 0;
		& li {
			flex-shrink: 0;
		}
		& a {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.625rem 0.875rem;
			font-size: 0.875rem;
			white-space: nowrap;
			color: var(--grey-text);
			transition:
				color 0.15s,
				background-color 0.15s;
			&:hover {
				color: var(--light-text);
			}
			&[aria-selected="true"] {
				color: var(--light-text);
			}
		}
		& fa {
			width: 1rem;
			font-size: 0.8125rem;
			text-align: center;
			opacity: 0.8;
		}
	}

	/* underlined row */
	.horizontal {
		margin-bottom: 1.5rem;
		overflow-x: auto;
		scrollbar-width: none;
		box-shadow: inset 0 -1px 0 var(--accent2);
		& a {
			position: relative;
			&[aria-selected="true"]::after {
				content: "";
				position: absolute;
				left: 0;
				right: 0;
				bottom: 0;
				height: 2px;
				background: var(--primary);
			}
		}
		&.justified li {
			flex: 1 0 auto;
			& a {
				justify-content: center;
			}
		}
	}

	/* a column with a bar beside the current tab */
	.vertical {
		flex-direction: column;
		gap: 0.125rem;
		& a {
			border-left: 2px solid transparent;
			&:hover {
				background: var(--accent);
			}
			&[aria-selected="true"] {
				background: var(--accent);
				border-left-color: var(--primary);
			}
		}
		@media (max-width: 767.9px) {
			flex-direction: row;
			gap: 0;
			margin-bottom: 1.5rem;
			overflow-x: auto;
			scrollbar-width: none;
			box-shadow: inset 0 -1px 0 var(--accent2);
			& a {
				border-left: 0;
				border-bottom: 2px solid transparent;
				&[aria-selected="true"] {
					background: none;
					border-bottom-color: var(--primary);
				}
			}
		}
	}
</style>
