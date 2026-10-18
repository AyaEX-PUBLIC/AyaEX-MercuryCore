import { fail } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { approveDevice } from "$lib/server/deviceCode"

// Approving a sign-in code shown by the Switch app (lib/server/deviceCode.ts)
export async function load({ locals }) {
	await authorise(locals)
}

export const actions: import("./$types").Actions = {}
actions.default = async ({ locals, request }) => {
	const { user } = await authorise(locals)
	const code = String((await request.formData()).get("code") || "")
	if (!(await approveDevice(code, user.id)))
		return fail(400, {
			code,
			error: "That code isn't valid, or has expired. Check the code on your device.",
		})
	return { approved: true }
}
