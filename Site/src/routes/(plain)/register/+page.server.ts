import config from "$lib/server/config"
import { inviteSettings } from "$lib/server/invites"
import { accountRegistered } from "$lib/server/register"

// Registration happens through /api/auth (lib/server/register.ts), as the
// browser makes the account's recovery phrase and signs with it. Who can
// register is set in Admin > Invites.
export async function load() {
	const settings = await inviteSettings()
	return {
		users: await accountRegistered(),
		mode: settings.registration,
		applications: settings.applications,
		emailsEnabled: config.Registration.Emails,
		prefix: config.Registration.Keys.Prefix,
	}
}
