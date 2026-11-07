import { clientFile } from "$lib/server/downloads"

export const load = async () => ({
	switchClient: await clientFile("switch"),
	wiiuClient: await clientFile("wiiu"),
})
