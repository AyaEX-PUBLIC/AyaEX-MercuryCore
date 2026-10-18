import { fail, isHttpError } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import {
	buyInvite,
	inviteSettings,
	memberInvites,
	purchaseStatus,
} from "$lib/server/invites"

export async function load({ locals }) {
	const { user } = await authorise(locals)
	const [{ invites, inviter }, purchase, settings] = await Promise.all([
		memberInvites(user.id),
		purchaseStatus(user),
		inviteSettings(),
	])
	return {
		invites,
		inviter,
		purchase,
		registration: settings.registration,
		perUserWeekly: settings.perUserWeekly,
		expiryDays: settings.expiryDays,
	}
}

export const actions: import("./$types").Actions = {}
actions.buy = async ({ locals, fetch }) => {
	const { user } = await authorise(locals)
	try {
		return { bought: await buyInvite(fetch, user) }
	} catch (e) {
		// e.g. the weekly limit, or not enough currency
		if (isHttpError(e)) return fail(e.status, { error: e.body.message })
		throw e
	}
}
