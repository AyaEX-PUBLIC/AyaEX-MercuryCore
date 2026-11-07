import { env } from "$env/dynamic/private"
import discordText from "$lib/discordText"
import config from "./config"

// The webhook URL is a secret: set it as DISCORD_MODERATION_WEBHOOK in
// Site/.env. Logging.DiscordModerationWebhook in mercury.core.ts is a fallback.
import { siteOrigin } from "./origin"

const defaultWebhook = () =>
	env.DISCORD_MODERATION_WEBHOOK || config.Logging.DiscordModerationWebhook

type Embed = {
	color: number
	title: string
	url?: string
	description: string
	fields: { name: string; value: string; inline?: boolean }[]
}

/** Posts one embed to the webhook. Never throws: the webhook is only a log. */
async function postEmbed(
	webhookUrl: string | undefined,
	what: string,
	embed: Embed
) {
	if (
		!webhookUrl ||
		webhookUrl.includes("123456789012345678/abcdefghijklmnopqrstuvwxyz")
	)
		return

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				allowed_mentions: { parse: [] }, // show Discord users, don't ping them
				embeds: [{ ...embed, timestamp: new Date().toISOString() }],
			}),
		})

		if (!response.ok)
			console.error(
				`Failed to send ${what} Discord webhook: ${response.status} ${response.statusText}`
			)
	} catch (error) {
		console.error(`Failed to send ${what} Discord webhook:`, error)
	}
}

export type ModerationDiscordWebhookPayload = {
	username: string
	action: string
	reason: string
	moderatorUsername?: string
	webhookUrl?: string
}

export function sendModerationDiscordWebhook({
	username,
	action,
	reason,
	moderatorUsername = "System",
	webhookUrl = defaultWebhook(),
}: ModerationDiscordWebhookPayload) {
	return postEmbed(webhookUrl, "moderation", {
		color: 0xf59e0b,
		title: "Moderation action",
		description: `**${username}** was moderated by **${moderatorUsername}**.`,
		fields: [
			{ name: "User Moderated", value: username, inline: true },
			{ name: "Action", value: action, inline: true },
			{ name: "Reason", value: reason, inline: false },
			{ name: "Moderator", value: moderatorUsername, inline: true },
		],
	})
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
export function sendRegistrationDiscordWebhook({
	username,
	regKey,
	discordId,
	discordName,
	initialAccount = false,
	webhookUrl = defaultWebhook(),
}: RegistrationDiscordWebhookPayload) {
	return postEmbed(webhookUrl, "registration", {
		color: 0x10b981,
		title: "New registration",
		description: `**${username}** created an account.`,
		fields: [
			{
				name: "Account",
				value: `[${username}](${siteOrigin()}/user/${encodeURIComponent(username)})`,
				inline: true,
			},
			{
				name: "Discord",
				value: discordId
					? `<@${discordId}> (${discordName ?? "?"})`
					: "Not linked",
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
		],
	})
}

export type ApplicationDiscordWebhookPayload = {
	username: string
	about: string
	contact: string
	pending: number // applications waiting, this one included
	webhookUrl?: string
}

/**
 * Tells staff about a new application to join (lib/server/invites.ts), with
 * a link to review it. The applicant's text is shown as written.
 */
export function sendApplicationDiscordWebhook({
	username,
	about,
	contact,
	pending,
	webhookUrl = defaultWebhook(),
}: ApplicationDiscordWebhookPayload) {
	const review = `${siteOrigin()}/admin/invites?tab=Applications`
	return postEmbed(webhookUrl, "application", {
		color: 0x3b82f6,
		title: "New application",
		url: review,
		description: `**${discordText(username)}** applied to join. ${
			pending === 1 ? "It's the only one" : `${pending} applications are`
		} waiting.\n[Review applications](${review})`,
		fields: [
			{ name: "Username", value: discordText(username), inline: true },
			{
				name: "Contact",
				value: contact ? discordText(contact) : "Not given",
				inline: true,
			},
			{ name: "About", value: discordText(about), inline: false },
		],
	})
}

export type AssetDiscordWebhookPayload = {
	id: number
	name: string
	slug: string
	type: string
	price: number
	description?: string
	creator: string
	webhookUrl?: string
}

/**
 * Tells staff about an uploaded asset waiting in Admin > Asset approval.
 * The asset's images aren't attached: they're private until it's approved.
 */
export function sendAssetDiscordWebhook({
	id,
	name,
	slug,
	type,
	price,
	description,
	creator,
	webhookUrl = defaultWebhook(),
}: AssetDiscordWebhookPayload) {
	const origin = siteOrigin()
	const review = `${origin}/admin/asset`
	return postEmbed(webhookUrl, "asset", {
		color: 0x8b5cf6,
		title: "New asset to approve",
		url: review,
		description: `**${discordText(creator)}** uploaded a ${type}.\n[Asset approval](${review}) · [Catalog page](${origin}/catalog/${id}/${slug})`,
		fields: [
			{ name: "Name", value: discordText(name), inline: true },
			{ name: "Type", value: type, inline: true },
			{
				name: "Price",
				value: price ? `${config.CurrencySymbol}${price}` : "Free",
				inline: true,
			},
			{
				name: "Creator",
				value: `[${discordText(creator)}](${origin}/user/${encodeURIComponent(creator)})`,
				inline: true,
			},
			...(description?.trim()
				? [{ name: "Description", value: discordText(description) }]
				: []),
		],
	})
}
