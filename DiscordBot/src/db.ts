import { Surreal } from "surrealdb"

// Registration keys handed out by the bot: one per Discord account, stored as
// Mercury regKey records (see Site/src/lib/server/init.surql) with the Discord
// account they belong to.

export type DbConfig = {
	url: string // ws://host:port
	username: string
	password: string
}

export type Claim =
	| { status: "issued" | "existing"; key: string; usesLeft: number }
	| { status: "used"; key: string; usedBy: string }
	| { status: "exhausted"; key: string }

const CREATOR = "InviteBot"
// 'noob' colours, as in mercury.core.ts
const bodyColours = { Head: 24, LeftArm: 24, LeftLeg: 119, RightArm: 24, RightLeg: 119, Torso: 23 }

export const db = new Surreal()

export async function connect(config: DbConfig) {
	for (let attempt = 1; ; attempt++)
		try {
			await db.connect(new URL(config.url), {
				namespace: "main",
				database: "main",
				authentication: { username: config.username, password: config.password },
			})
			return
		} catch (e) {
			console.error(`Database connection failed (attempt ${attempt}):`, (e as Error).message)
			await Bun.sleep(Math.min(attempt, 10) * 1000)
		}
}

// The account recorded as creator of the bot's keys (Mercury requires one, and
// logs key creation against it). It has no recovery phrase or password, so
// nobody can log into it.
let creatorId: unknown
async function creator() {
	if (creatorId) return creatorId
	const [existing] = await db.query<[unknown[]]>("SELECT VALUE id FROM user WHERE username = $name", {
		name: CREATOR,
	})
	if (existing[0]) return (creatorId = existing[0])

	const [, created] = await db.query<[unknown, unknown]>(
		`LET $id = (CREATE ONLY user CONTENT {
			bodyColours: $bodyColours,
			description: [{ text: "Hands out registration keys from Discord." }],
			email: "",
			permissionLevel: 1,
			username: $name,
		} RETURN VALUE id);
		RETURN $id;`,
		{
			bodyColours,
			name: CREATOR,
		}
	)
	console.log(`Created the ${CREATOR} account`)
	return (creatorId = created)
}

type KeyRow = { key: string; usesLeft: number; usedBy?: string }

async function findKey(discordId: string) {
	const [rows] = await db.query<[KeyRow[]]>(
		`SELECT
			record::id(id) AS key,
			created,
			usesLeft,
			(<-used<-user.username)[0] AS usedBy
		FROM regKey WHERE discordId = $discordId
		ORDER BY created DESC LIMIT 1`,
		{ discordId }
	)
	return rows[0]
}

// one claim at a time per Discord account, so double submits can't create two keys
const locks = new Map<string, Promise<unknown>>()
function withLock<T>(id: string, fn: () => Promise<T>) {
	const run = (locks.get(id) ?? Promise.resolve()).then(fn, fn)
	locks.set(id, run)
	// cleanup on both outcomes; this chain also handles the rejection, which
	// would otherwise be unhandled and crash the process
	const cleanup = () => locks.get(id) === run && locks.delete(id)
	run.then(cleanup, cleanup)
	return run
}

/**
 * Returns the Discord account's key, issuing one with `uses` uses the first time.
 */
export const claimKey = (discordId: string, discordName: string, uses: number) =>
	withLock(discordId, async (): Promise<Claim> => {
		const existing = await findKey(discordId)
		if (existing) {
			if (existing.usedBy && existing.usesLeft < 1)
				return { status: "used", key: existing.key, usedBy: existing.usedBy }
			if (existing.usesLeft < 1) return { status: "exhausted", key: existing.key }
			return { status: "existing", key: existing.key, usesLeft: existing.usesLeft }
		}

		const [key] = await db.query<[string]>(
			`(CREATE ONLY type::record("regKey", rand::id()) CONTENT {
				creator: $creator,
				usesLeft: $uses,
				discordId: $discordId,
				discordName: $discordName,
			} RETURN VALUE record::id(id))`,
			{ creator: await creator(), uses, discordId, discordName }
		)
		return { status: "issued", key, usesLeft: uses }
	})

// Lookups for /getuser: from a Discord account to the Mercury account it
// registered, or from a Mercury account to the key (and Discord account) used

export type Account = {
	username: string
	permissionLevel: number
	created: number // unix seconds
	lastOnline: number
	moderation?: { type: string; note: string }
}

export type KeyMatch = {
	key: string
	usesLeft: number
	created: number
	discordId?: string
	discordName?: string
	account?: Account
}

export type AccountMatch = Account & { key?: KeyMatch }

const accountFields = `
	username,
	permissionLevel,
	time::unix(created) AS created,
	time::unix(lastOnline) AS lastOnline,
	(SELECT type, note FROM moderation WHERE out = $parent.id AND active = true LIMIT 1)[0] AS moderation`

export async function keysForDiscord(discordId: string) {
	const [rows] = await db.query<[KeyMatch[]]>(
		`SELECT
			record::id(id) AS key,
			usesLeft,
			time::unix(created) AS created,
			discordId,
			discordName,
			(SELECT ${accountFields} FROM $parent<-used<-user)[0] AS account
		FROM regKey WHERE discordId = $discordId
		ORDER BY created DESC`,
		{ discordId }
	)
	return rows
}

export async function accountByUsername(username: string) {
	const [rows] = await db.query<[AccountMatch[]]>(
		`SELECT
			${accountFields},
			(SELECT
				record::id(id) AS key,
				usesLeft,
				time::unix(created) AS created,
				discordId,
				discordName
			FROM $parent->used->regKey)[0] AS key
		FROM user WHERE string::lowercase(username) = string::lowercase($username)
		LIMIT 1`,
		{ username }
	)
	return rows[0]
}
