import { redirect } from "@sveltejs/kit"
import { dev } from "$app/environment"
import config from "$lib/server/config"

// Redirect to check page if in development mode
export async function load() {
	if (dev) redirect(302, "/check")
	return { descriptions: Object.entries(config.Branding.Descriptions) }
}
