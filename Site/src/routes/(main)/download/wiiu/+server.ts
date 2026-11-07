import { authorise } from "$lib/server/auth"
import { downloadClient } from "$lib/server/downloads"

// (endpoints don't run the (main) layout's check, so this one does its own)
export async function GET({ locals }) {
	await authorise(locals)
	return downloadClient("wiiu", "Wii U")
}
