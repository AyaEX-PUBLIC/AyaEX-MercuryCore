import { authorise } from "$lib/server/auth"

export async function load({ locals }) {
	await authorise(locals)
}
