import config from "$lib/server/config"
import { accountRegistered } from "$lib/server/register"

// Registration happens through /api/auth (lib/server/register.ts), as the
// browser makes the account's recovery phrase and signs with it
export const load = async () => ({
	users: await accountRegistered(),
	regKeysEnabled: config.Registration.Keys.Enabled,
	emailsEnabled: config.Registration.Emails,
	prefix: config.Registration.Keys.Prefix,
})
