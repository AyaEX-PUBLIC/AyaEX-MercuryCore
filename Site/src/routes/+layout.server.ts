import config from "$lib/server/config"
import { getBalance } from "$lib/server/economy"
import { db } from "$lib/server/surreal"
import bannersQuery from "./banners.surql"
import getNotifications from "./notifications"

type Banner = {
	// bruce, it's- I'm not doing this again
	id: string
	bgColour: string
	body: string
	textLight: boolean
}

export async function load({ fetch: f, locals, request }) {
	const { user } = locals
	// No authorise() function call, as we don't want to redirect to login page if not logged in

	const [banners] = await db.query<Banner[][]>(bannersQuery)
	// shown in the top bar; null if logged out or the Economy service is down
	const balance = user ? await getBalance(f, user.id) : undefined
	return {
		balance: balance?.ok ? Number(balance.value) : null,
		banners,
		user,
		notifications: await getNotifications(user),
		url: request.url,
		domain: config.Domain,
		currencySymbol: config.CurrencySymbol,
		siteName: config.Name,
		tagline: config.Branding.Tagline,
		longTagline: config.Branding.LongTagline,
		pages: config.Pages,
	}
}
