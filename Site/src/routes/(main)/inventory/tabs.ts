// The inventory's tabs, and the asset types each one lists (the same as the
// catalog's, so everything you can buy shows up here)

import { bodyPartTypes } from "$lib/assetTypes"

export const inventoryTabs: { [tab: string]: readonly number[] } =
	Object.freeze({
		Hats: [8],
		"T-Shirts": [2],
		Shirts: [11],
		Pants: [12],
		Decals: [13],
		Faces: [18],
		Heads: [17],
		"Body Parts": bodyPartTypes,
		Gear: [19],
	})

/** The tab named in the URL, or the first one */
export function currentTab(url: URL, tabs: { [tab: string]: unknown }) {
	const tab = url.searchParams.get("tab")
	return tab && Object.hasOwn(tabs, tab) ? tab : Object.keys(tabs)[0]
}
