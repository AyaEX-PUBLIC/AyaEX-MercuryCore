import {
	type ChatInputCommandInteraction,
	Client,
	EmbedBuilder,
	Events,
	GatewayIntentBits,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js"
import { type Account, accountByUsername, claimKey, connect, type KeyMatch, keysForDiscord } from "./db"
import { membersWithMessages, messageCount, scanRemaining, startMessageCounting } from "./messages"

function env(name: string, fallback?: string) {
	const value = process.env[name]?.trim() || fallback
	if (!value) {
		console.error(`Missing ${name}: set it in DiscordBot/.env (see .env.example)`)
		process.exit(1)
	}
	return value
}

// Mercury's own config (mounted read-only into the container), so the key
// prefix and site name always match what the register page expects
type MercuryConfig = { Name: string; Registration: { Keys: { Enabled: boolean; Prefix: string } } }
const mercuryConfigPath = process.env.MERCURY_CONFIG || "/app/mercury.core.ts"
const mercury: MercuryConfig | undefined = await import(mercuryConfigPath)
	.then(m => m.default)
	.catch(() => undefined)
if (!mercury) console.warn(`Couldn't load ${mercuryConfigPath}; using SITE_NAME and KEY_PREFIX`)
else if (!mercury.Registration.Keys.Enabled)
	console.warn("Registration keys are disabled in mercury.core.ts, so keys aren't needed to register")

const config = {
	token: env("DISCORD_TOKEN"),
	guildId: env("DISCORD_GUILD_ID"),
	channelId: env("DISCORD_CHANNEL_ID"),
	roleId: env("DISCORD_ROLE_ID"),
	siteName: mercury?.Name ?? env("SITE_NAME", "Mercury"),
	siteUrl: env("SITE_URL").replace(/\/+$/, ""),
	keyPrefix: mercury?.Registration.Keys.Prefix ?? env("KEY_PREFIX", "mercurkey-"),
	keyUses: Number.parseInt(env("KEY_USES", "1"), 10),
	db: {
		url: env("DB_URL", "ws://database:8000"),
		username: env("DB_USERNAME", "root"),
		password: env("DB_PASSWORD", "root"),
	},
}
if (!(config.keyUses >= 1)) {
	console.error("KEY_USES must be a positive integer")
	process.exit(1)
}

const inviteCommand = new SlashCommandBuilder()
	.setName("invite")
	.setDescription(`Get your ${config.siteName} registration key`)
	.setDMPermission(false)

// hidden from everyone but server administrators (checked again when run)
const getuserCommand = new SlashCommandBuilder()
	.setName("getuser")
	.setDescription(`Find the ${config.siteName} account of a Discord member, or the reverse`)
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.addUserOption(o => o.setName("discord").setDescription("Discord member"))
	.addStringOption(o =>
		o.setName("username").setDescription(`${config.siteName} username`).setMaxLength(21)
	)

const ephemeral = { flags: MessageFlags.Ephemeral } as const

function hasRole(interaction: ChatInputCommandInteraction) {
	const roles = interaction.member?.roles
	if (!roles) return false
	return Array.isArray(roles) ? roles.includes(config.roleId) : roles.cache.has(config.roleId)
}

async function invite(interaction: ChatInputCommandInteraction) {
	if (interaction.guildId !== config.guildId)
		return interaction.reply({ content: "This command isn't available here.", ...ephemeral })
	if (interaction.channelId !== config.channelId)
		return interaction.reply({
			content: `Use this command in <#${config.channelId}>.`,
			...ephemeral,
		})
	if (!hasRole(interaction))
		return interaction.reply({
			content: `You need the <@&${config.roleId}> role to get a key.`,
			...ephemeral,
			allowedMentions: { parse: [] },
		})

	await interaction.deferReply(ephemeral)

	const { user } = interaction
	const claim = await claimKey(user.id, user.username, config.keyUses)
	const key = `${config.keyPrefix}${claim.key}`
	console.log(`/invite by ${user.username} (${user.id}): ${claim.status}`)

	const register = `${config.siteUrl}/register`
	switch (claim.status) {
		case "issued":
		case "existing":
			return interaction.editReply(
				`${claim.status === "issued" ? "Here's" : "You already have"} your ${config.siteName} registration key:\n` +
					`\`\`\`${key}\`\`\`` +
					`Register at ${register}. It's linked to your Discord account` +
					(claim.usesLeft === 1 ? " and works once." : ` (${claim.usesLeft} uses left).`) +
					" Don't share it."
			)
		case "used":
			return interaction.editReply(
				`Your key was already used to create the ${config.siteName} account **${claim.usedBy}**.`
			)
		case "exhausted":
			return interaction.editReply("Your key has no uses left. Ask a staff member if you need a new one.")
	}
}

// hidden from everyone but server administrators (checked again when run)
const autoaddCommand = new SlashCommandBuilder()
	.setName("autoadd")
	.setDescription("Give a role to members who joined long enough ago, have a role and enough messages")
	.setDMPermission(false)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.addRoleOption(o => o.setName("role").setDescription("Role to give (e.g. tester)").setRequired(true))
	.addRoleOption(o =>
		o.setName("required_role").setDescription("Members must already have this role").setRequired(true)
	)
	.addIntegerOption(o =>
		o.setName("min_days").setDescription("Joined the server at least this many days ago").setMinValue(0).setRequired(true)
	)
	.addIntegerOption(o =>
		o.setName("min_messages").setDescription("Sent at least this many messages in the server").setMinValue(1).setRequired(true)
	)
	.addBooleanOption(o => o.setName("dry_run").setDescription("Only list who would get the role"))

const roleNames = ["User", "Verified", "Catalog Manager", "Moderator", "Administrator"]
const time = (unix: number) => `<t:${unix}:f> (<t:${unix}:R>)`
const discordUser = (id?: string, name?: string) => (id ? `<@${id}> (${name ?? "?"}, \`${id}\`)` : "Not linked")

function accountFields(account: Account) {
	const fields = [
		{
			name: `${config.siteName} account`,
			value: `[${account.username}](${config.siteUrl}/user/${account.username})`,
			inline: true,
		},
		{ name: "Role", value: roleNames[account.permissionLevel - 1] ?? String(account.permissionLevel), inline: true },
		{ name: "Registered", value: time(account.created) },
		{ name: "Last online", value: time(account.lastOnline) },
	]
	if (account.moderation)
		fields.push({
			name: "Moderation",
			value: `${account.moderation.type}: ${account.moderation.note}`.slice(0, 1024),
		})
	return fields
}

function keyField(key: KeyMatch) {
	const state = key.account ? "used" : key.usesLeft > 0 ? `${key.usesLeft} use(s) left` : "disabled"
	return { name: "Registration key", value: `\`${config.keyPrefix}${key.key}\` (${state}), issued ${time(key.created)}` }
}

async function getuser(interaction: ChatInputCommandInteraction) {
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
		return interaction.reply({ content: "This command is for administrators.", ...ephemeral })

	const member = interaction.options.getUser("discord")
	const username = interaction.options.getString("username")?.trim()
	if (!member === !username)
		return interaction.reply({
			content: "Give either a Discord member or a username (not both).",
			...ephemeral,
		})

	await interaction.deferReply(ephemeral)
	const embed = new EmbedBuilder().setColor(0x5865f2)

	if (member) {
		const keys = await keysForDiscord(member.id)
		embed.setTitle(`Discord: ${member.username}`).addFields(
			{ name: "Discord", value: discordUser(member.id, member.username) },
			{ name: "Messages counted", value: String(await messageCount(member.id)), inline: true }
		)
		if (!keys.length) embed.setDescription("No registration key was issued to this member.")
		for (const [i, key] of keys.slice(0, 3).entries()) {
			if (i) embed.addFields({ name: "\u200b", value: "Older key" })
			embed.addFields(keyField(key))
			if (key.account) embed.addFields(accountFields(key.account))
			else embed.addFields({ name: `${config.siteName} account`, value: "None yet" })
		}
	} else {
		const account = await accountByUsername(username as string)
		if (!account)
			return interaction.editReply(`No ${config.siteName} account named **${username}**.`)
		embed.setTitle(`${config.siteName}: ${account.username}`).addFields(accountFields(account))
		embed.addFields({ name: "Discord", value: discordUser(account.key?.discordId, account.key?.discordName) })
		if (account.key) embed.addFields(keyField({ ...account.key, account }))
		else embed.addFields({ name: "Registration key", value: "None (registered without a key)" })
	}

	console.log(`/getuser by ${interaction.user.username}: ${member ? `discord ${member.id}` : `username ${username}`}`)
	return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } })
}

async function autoadd(interaction: ChatInputCommandInteraction) {
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
		return interaction.reply({ content: "This command is for administrators.", ...ephemeral })
	const guild = interaction.guild
	if (!guild || guild.id !== config.guildId)
		return interaction.reply({ content: "This command isn't available here.", ...ephemeral })

	const role = interaction.options.getRole("role", true)
	const requiredRole = interaction.options.getRole("required_role", true)
	const minDays = interaction.options.getInteger("min_days", true)
	const minMessages = interaction.options.getInteger("min_messages", true)
	const dryRun = interaction.options.getBoolean("dry_run") ?? false

	const me = guild.members.me ?? (await guild.members.fetchMe())
	if (!dryRun) {
		if (!me.permissions.has(PermissionFlagsBits.ManageRoles))
			return interaction.reply({ content: "I need the **Manage Roles** permission.", ...ephemeral })
		if (role.managed || role.position >= me.roles.highest.position)
			return interaction.reply({
				content: `I can't give <@&${role.id}>: move my role above it in Server Settings → Roles.`,
				...ephemeral,
				allowedMentions: { parse: [] },
			})
	}

	await interaction.deferReply(ephemeral)
	const joinedBefore = Date.now() - minDays * 86_400_000
	const candidates = await membersWithMessages(minMessages)
	const added: string[] = []
	let alreadyHad = 0
	let failed = 0

	for (const [i, { id }] of candidates.entries()) {
		if (i && i % 50 === 0)
			await interaction.editReply(`Checking members... ${i}/${candidates.length}`).catch(() => {})
		// fresh from the API (no member intent, so the cache could have old roles); null: left
		const member = await guild.members.fetch({ user: id, force: true }).catch(() => null)
		if (!member?.joinedTimestamp || member.joinedTimestamp > joinedBefore) continue
		if (!member.roles.cache.has(requiredRole.id)) continue
		if (member.roles.cache.has(role.id)) {
			alreadyHad++
			continue
		}
		if (!dryRun)
			try {
				await member.roles.add(role.id, `/autoadd by ${interaction.user.username}`)
			} catch (e) {
				failed++
				console.error(`/autoadd: couldn't give ${role.name} to ${member.user.username}:`, (e as Error).message)
				continue
			}
		added.push(member.id)
	}

	const remaining = scanRemaining()
	const list = added.slice(0, 60).map(id => `<@${id}>`).join(" ")
	const summary =
		`${dryRun ? "**Dry run**: would give" : "Gave"} <@&${role.id}> to **${added.length}** member(s)` +
		` (joined ${minDays}+ days ago, with <@&${requiredRole.id}>, ${minMessages}+ messages).` +
		(alreadyHad ? `\n${alreadyHad} already had it.` : "") +
		(failed ? `\n${failed} failed (see the bot log).` : "") +
		(remaining
			? `\n⚠️ Message history is still being counted (${remaining} channel(s) left), so some members may be missing; run it again later.`
			: "") +
		(list ? `\n${list}${added.length > 60 ? ` and ${added.length - 60} more` : ""}` : "")
	console.log(`/autoadd by ${interaction.user.username}: ${dryRun ? "dry run, " : ""}${added.length} member(s), role ${role.name}`)
	return interaction.editReply({ content: summary.slice(0, 2000), allowedMentions: { parse: [] } })
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] })

client.once(Events.ClientReady, async ready => {
	// a guild command shows up immediately (global ones can take an hour)
	await ready.application.commands.set(
		[inviteCommand.toJSON(), getuserCommand.toJSON(), autoaddCommand.toJSON()],
		config.guildId
	)
	console.log(`Logged in as ${ready.user.tag}; /invite, /getuser and /autoadd registered in guild ${config.guildId}`)
	await startMessageCounting(ready, config.guildId)
})

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return
	const handler = { invite, getuser, autoadd }[interaction.commandName]
	if (!handler) return
	try {
		await handler(interaction)
	} catch (e) {
		console.error(`/${interaction.commandName} failed:`, e)
		const reply = { content: "Something went wrong, please try again later.", ...ephemeral }
		if (interaction.deferred || interaction.replied) await interaction.editReply(reply.content).catch(() => {})
		else await interaction.reply(reply).catch(() => {})
	}
})

await connect(config.db)
console.log("Connected to the database")
await client.login(config.token)
