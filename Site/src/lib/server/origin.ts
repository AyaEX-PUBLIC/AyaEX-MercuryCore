import { env } from "$env/dynamic/private"
import config from "$lib/server/config"

/**
 * The public origin of the Site, including its scheme, e.g. http://localhost:8010 or https://mercs.dev
 */
export const siteOrigin = () =>
	(env.ORIGIN || `https://${config.Domain}`).replace(/\/+$/, "")
