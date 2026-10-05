import {
	type Client,
	type Guild,
	type Message,
	PermissionFlagsBits,
} from "discord.js"
import { db } from "./db"

// Per-member message counts, for /autoadd. Discord has no "total messages" API
// for bots, so the bot counts them itself: it scans each readable channel's
// history once (resumable), and counts new messages live. Each channel's
// counted range of message IDs is [oldest, newest], so nothing is counted twice.

type ScanState = {
	newest?: string // highest counted message ID
	oldest?: string // lowest counted message ID
	done: boolean // history before `oldest` is fully counted
}

const states = new Map<string, ScanState>()
const live = new Set<string>() // channels caught up to the present: count live messages
let channelsListed = false // after this, a channel without state is a new one
let scanning = false
let scanQueue = 0

const later = (a: string, b?: string) => !b || BigInt(a) > BigInt(b)
const earlier = (a: string, b?: string) => !b || BigInt(a) < BigInt(b)

function countable(message: Message) {
	return !message.author.bot && !message.webhookId && !message.system
}

async function save(channelId: string, state: ScanState, messages: Message[]) {
	const perAuthor = new Map<string, { id: string; name: string; n: number }>()
	for (const m of messages)
		if (countable(m)) {
			const entry = perAuthor.get(m.author.id) ?? { id: m.author.id, name: m.author.username, n: 0 }
			entry.n++
			perAuthor.set(m.author.id, entry)
		}

	await db.query(
		`BEGIN TRANSACTION;
		FOR $e IN $entries {
			UPSERT type::record("discordMessages", $e.id) SET count += $e.n, username = $e.name;
		};
		UPSERT type::record("discordChannelScan", $channel) CONTENT $state;
		COMMIT TRANSACTION;`,
		{ entries: [...perAuthor.values()], channel: channelId, state }
	)
}

function readable(guild: Guild, channel: { permissionsFor?: unknown } & object) {
	const me = guild.members.me
	if (!me || !("permissionsFor" in channel) || typeof channel.permissionsFor !== "function") return false
	return channel
		.permissionsFor(me)
		?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])
}

async function scannableChannels(guild: Guild) {
	const channels = [...(await guild.channels.fetch()).values()].filter(
		c => c?.isTextBased() && readable(guild, c)
	)
	const threads = [...(await guild.channels.fetchActiveThreads()).threads.values()].filter(t =>
		readable(guild, t)
	)
	return [...channels, ...threads].filter(c => c && "messages" in c) as unknown as {
		id: string
		name: string
		messages: { fetch(o: { limit: number; before?: string; after?: string; cache: boolean }): Promise<Map<string, Message>> }
	}[]
}

// the bot's own tables (the database runs in strict mode)
const schema = `
DEFINE TABLE OVERWRITE discordMessages SCHEMAFULL TYPE NORMAL;
	DEFINE FIELD OVERWRITE count ON discordMessages TYPE int DEFAULT 0;
	DEFINE FIELD OVERWRITE username ON discordMessages TYPE string;
DEFINE TABLE OVERWRITE discordChannelScan SCHEMAFULL TYPE NORMAL;
	DEFINE FIELD OVERWRITE newest ON discordChannelScan TYPE option<string>;
	DEFINE FIELD OVERWRITE oldest ON discordChannelScan TYPE option<string>;
	DEFINE FIELD OVERWRITE done ON discordChannelScan TYPE bool DEFAULT false;
`

async function loadStates() {
	await db.query(schema)
	const [rows] = await db.query<[({ id: string } & ScanState)[]]>(
		"SELECT record::id(id) AS id, newest, oldest, done FROM discordChannelScan"
	)
	for (const row of rows) states.set(row.id, { newest: row.newest, oldest: row.oldest, done: row.done })
}

async function scan(guild: Guild) {
	const channels = await scannableChannels(guild)
	scanQueue = channels.length

	// 1. catch every channel up to the present, so live counting can start
	for (const channel of channels) {
		const state = states.get(channel.id) ?? { done: false }
		try {
			if (!state.newest) {
				const page = [...(await channel.messages.fetch({ limit: 100, cache: false })).values()]
				for (const m of page) {
					if (later(m.id, state.newest)) state.newest = m.id
					if (earlier(m.id, state.oldest)) state.oldest = m.id
				}
				if (!page.length) state.done = true
				await save(channel.id, state, page)
			}
			for (;;) {
				const page = [...(await channel.messages.fetch({ limit: 100, after: state.newest, cache: false })).values()]
				if (!page.length) break
				for (const m of page) if (later(m.id, state.newest)) state.newest = m.id
				await save(channel.id, state, page)
			}
		} catch (e) {
			console.error(`Message scan: can't read #${channel.name}:`, (e as Error).message)
		}
		states.set(channel.id, state)
		live.add(channel.id)
	}
	channelsListed = true
	console.log(`Message counting: ${channels.length} channels caught up, counting live`)

	// 2. count older history, channel by channel
	for (const channel of channels) {
		const state = states.get(channel.id) as ScanState
		try {
			while (!state.done) {
				const page = [...(await channel.messages.fetch({ limit: 100, before: state.oldest, cache: false })).values()]
				if (!page.length) state.done = true
				for (const m of page) if (earlier(m.id, state.oldest)) state.oldest = m.id
				await save(channel.id, state, page)
			}
		} catch (e) {
			console.error(`Message scan: stopped in #${channel.name}:`, (e as Error).message)
		}
		scanQueue--
	}
	console.log("Message counting: history scan finished")
}

export async function startMessageCounting(client: Client, guildId: string) {
	await loadStates()
	client.on("messageCreate", async message => {
		if (message.guildId !== guildId || !countable(message)) return
		let state = states.get(message.channelId)
		if (!state) {
			if (!channelsListed) return // the startup scan will count it
			// a channel or thread that appeared after startup: counted from here on
			state = { newest: message.id, oldest: message.id, done: true }
			states.set(message.channelId, state)
			live.add(message.channelId)
		} else if (!live.has(message.channelId)) return // still being caught up (that covers it)
		if (later(message.id, state.newest)) state.newest = message.id
		await save(message.channelId, state, [message]).catch(e =>
			console.error("Message counting failed:", (e as Error).message)
		)
	})

	const guild = client.guilds.cache.get(guildId)
	if (!guild) return console.error("Message counting: the bot isn't in DISCORD_GUILD_ID")
	if (scanning) return
	scanning = true
	scan(guild)
		.catch(e => console.error("Message scan failed:", e))
		.finally(() => (scanning = false))
}

/** Channels whose history is still being counted (0 = complete). */
export const scanRemaining = () => (scanning ? Math.max(scanQueue, 1) : 0)

export async function messageCount(userId: string) {
	const [[row]] = await db.query<[{ count: number }[]]>(
		'SELECT count FROM type::record("discordMessages", $id)',
		{ id: userId }
	)
	return row?.count ?? 0
}

export async function membersWithMessages(min: number) {
	const [rows] = await db.query<[{ id: string; count: number }[]]>(
		"SELECT record::id(id) AS id, count FROM discordMessages WHERE count >= $min ORDER BY count DESC",
		{ min }
	)
	return rows
}
