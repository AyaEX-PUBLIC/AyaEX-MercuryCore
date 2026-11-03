// Keeps the current tab in the URL and starts each tab on page 1, so the
// server loads the tab being viewed, and pagination links (and reloads) stay
// on it. Call it once from a component, with the tabs' TabData state.

import { untrack } from "svelte"
import { goto } from "$app/navigation"
import { page } from "$app/state"

export default function tabInUrl(tabData: { name: string; currentTab: string }) {
	let shownTab = tabData.currentTab
	$effect(() => {
		const tab = tabData.currentTab
		if (tab === shownTab) return
		shownTab = tab
		const url = new URL(untrack(() => page.url))
		url.searchParams.set(tabData.name, tab)
		url.searchParams.delete("p")
		goto(url.pathname + url.search, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		})
	})
}
