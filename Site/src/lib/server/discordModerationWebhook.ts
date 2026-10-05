import { env } from "$env/dynamic/private"
import config from "./config"

// The webhook URL is a secret: set it as DISCORD_MODERATION_WEBHOOK in
// Site/.env. Logging.DiscordModerationWebhook in mercury.core.ts is a fallback.
import { siteOrigin } from "./origin"

export type ModerationDiscordWebhookPayload = {
	username: string
	action: string
	reason: string
	moderatorUsername?: string
	webhookUrl?: string
}

export async function sendModerationDiscordWebhook({
	username,
	action,
	reason,
	moderatorUsername = "System",
	webhookUrl = env.DISCORD_MODERATION_WEBHOOK || config.Logging.DiscordModerationWebhook,
}: ModerationDiscordWebhookPayload) {
	if (!webhookUrl || webhookUrl.includes("123456789012345678/abcdefghijklmnopqrstuvwxyz"))
		return

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				embeds: [
					{
						color: 0xf59e0b,
						title: "Moderation action",
						description: `**${username}** was moderated by **${moderatorUsername}**.`,
						fields: [
							{ name: "User Moderated", value: username, inline: true },
							{ name: "Action", value: action, inline: true },
							{ name: "Reason", value: reason, inline: false },
							{ name: "Moderator", value: moderatorUsername, inline: true },
						],
						timestamp: new Date().toISOString(),
					},
				],
			}),
		})

		if (!response.ok)
			console.error(
				`Failed to send moderation Discord webhook: ${response.status} ${response.statusText}`
			)
	} catch (error) {
		console.error("Failed to send moderation Discord webhook:", error)
	}
}

export type RegistrationDiscordWebhookPayload = {
	username: string
	regKey?: string // id, without the prefix
	discordId?: string
	discordName?: string
	initialAccount?: boolean
	webhookUrl?: string
}

/**
 * Logs a new account to the same Discord webhook as moderation actions.
 */
export async function sendRegistrationDiscordWebhook({
	username,
	regKey,
	discordId,
	discordName,
	initialAccount = false,
	webhookUrl = env.DISCORD_MODERATION_WEBHOOK || config.Logging.DiscordModerationWebhook,
}: RegistrationDiscordWebhookPayload) {
	if (!webhookUrl || webhookUrl.includes("123456789012345678/abcdefghijklmnopqrstuvwxyz"))
		return

	const fields = [
		{
			name: "Account",
			value: `[${username}](${siteOrigin()}/user/${encodeURIComponent(username)})`,
			inline: true,
		},
		{
			name: "Discord",
			value: discordId ? `<@${discordId}> (${discordName ?? "?"})` : "Not linked",
			inline: true,
		},
		{
			name: "Registration key",
			value: initialAccount
				? "None (first account, administrator)"
				: regKey
					? `\`${config.Registration.Keys.Prefix}${regKey}\``
					: "None (keys disabled)",
			inline: false,
		},
	]

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				allowed_mentions: { parse: [] }, // show the Discord user, don't ping them
				embeds: [
					{
						color: 0x10b981,
						title: "New registration",
						description: `**${username}** created an account.`,
						fields,
						timestamp: new Date().toISOString(),
					},
				],
			}),
		})

		if (!response.ok)
			console.error(
				`Failed to send registration Discord webhook: ${response.status} ${response.statusText}`
			)
	} catch (error) {
		console.error("Failed to send registration Discord webhook:", error)
	}
}
