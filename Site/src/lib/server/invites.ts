// The invite system. Invites are registration keys (regKey): made by
// administrators, the Discord bot, members who buy them, or approved
// applications. Who used whose key makes the invite tree. Everything is set
// in Admin > Invites and kept in stuff:invites.

import { createHash } from "node:crypto"
import { error } from "@sveltejs/kit"
import { type } from "arktype"
import config from "$lib/server/config"
import { burn, mint } from "$lib/server/economy"
import oneAtATime from "$lib/server/oneAtATime"
import { randomCode } from "$lib/server/resetCode"
import { db, Record, type RecordId } from "$lib/server/surreal"
import { usernameTest } from "$lib/typeTests"

export const registrationModes = ["invite", "open", "closed"] as const

export const settingsSchema = type({
	/** invite: a key or an approved application is needed; open: anyone; closed: nobody */
	registration: type.enumerated(...registrationModes),
	/** members can buy invites */
	purchases: "boolean",
	price: "0 <= number.integer <= 1000000",
	/** invites each member can buy per week (Monday to Sunday, UTC) */
	perUserWeekly: "0 <= number.integer <= 100",
	/** invites everyone together can buy per week; 0 = no limit */
	siteWeekly: "0 <= number.integer <= 100000",
	minAccountDays: "0 <= number.integer <= 3650",
	/** days until an unused invite expires; 0 = never */
	expiryDays: "0 <= number.integer <= 365",
	/** people without an invite can apply */
	applications: "boolean",
	question: "1 <= string <= 200",
	/** profiles show who invited whom */
	treePublic: "boolean",
})
export type InviteSettings = typeof settingsSchema.infer

export const defaultSettings: InviteSettings = Object.freeze({
	registration: config.Registration.Keys.Enabled ? "invite" : "open",
	purchases: false,
	price: 25,
	perUserWeekly: 1,
	siteWeekly: 0,
	minAccountDays: 7,
	expiryDays: 14,
	applications: false,
	question: "Why would you like to join?",
	treePublic: false,
})

export async function inviteSettings(): Promise<InviteSettings> {
	const [stored] = await db.query<(Partial<InviteSettings> | null)[]>(
		"SELECT * OMIT id FROM ONLY stuff:invites"
	)
	const checked = settingsSchema({ ...defaultSettings, ...stored })
	return checked instanceof type.errors ? defaultSettings : checked
}

export async function saveSettings(settings: InviteSettings, admin: string) {
	await db.query(
		`UPSERT stuff:invites CONTENT $settings;
		fn::auditLog("Administration", $note, $admin);`,
		{
			settings,
			admin: Record("user", admin),
			note: `Change invite settings: registration ${settings.registration}, buying ${settings.purchases ? `on (${settings.price} each, ${settings.perUserWeekly}/week each, ${settings.siteWeekly || "no"} weekly limit overall)` : "off"}, applications ${settings.applications ? "on" : "off"}`,
		}
	)
}

export const inviteCode = (key: string) =>
	`${config.Registration.Keys.Prefix}${key}`

/** The start of this week, Monday 00:00 UTC */
export function weekStart(now = new Date()) {
	const day = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	)
	day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
	return day
}

export type PurchaseStatus = {
	enabled: boolean
	/** why this account can't buy one now, if it can't */
	reason: string
	price: number
	/** left this week for this account, and for everyone (null = no limit) */
	left: number
	siteLeft: number | null
	resets: Date
}

/** Whether a member can buy an invite now, and how many are left this week */
export async function purchaseStatus(user: User): Promise<PurchaseStatus> {
	const settings = await inviteSettings()
	const week = weekStart()
	const resets = new Date(week.getTime() + 7 * 864e5)
	const [mine, all, account] = await db.query<
		[number, number, { revoked: boolean; created: Date }]
	>(
		`count(SELECT 1 FROM regKey WHERE kind = "purchase" AND creator = $user AND created >= $week);
		count(SELECT 1 FROM regKey WHERE kind = "purchase" AND created >= $week);
		SELECT invitesRevoked = true AS revoked, created FROM ONLY $user;`,
		{ user: Record("user", user.id), week }
	)
	const left = Math.max(0, settings.perUserWeekly - mine)
	const siteLeft = settings.siteWeekly
		? Math.max(0, settings.siteWeekly - all)
		: null
	// (the session's user doesn't have its creation date)
	const ageDays = (Date.now() - new Date(account.created).getTime()) / 864e5

	let reason = ""
	if (!settings.purchases) reason = "Buying invites is turned off"
	else if (settings.registration !== "invite")
		reason =
			settings.registration === "open"
				? "Registration is open, so nobody needs an invite"
				: "Registration is closed"
	else if (account.revoked) reason = "Your invites have been revoked by staff"
	else if (ageDays < settings.minAccountDays)
		reason = `Your account needs to be ${settings.minAccountDays} days old`
	else if (!left) reason = "You've bought all your invites for this week"
	else if (siteLeft === 0) reason = "This week's invites have all been bought"

	return {
		enabled: settings.purchases && settings.registration === "invite",
		reason,
		price: settings.price,
		left,
		siteLeft,
		resets,
	}
}

/**
 * Buys an invite: takes the price, then makes a one-use key.
 * @returns The invite code.
 */
export const buyInvite = (f: typeof fetch, user: User) =>
	// one at a time, so weekly limits hold
	oneAtATime("invites", async () => {
		const status = await purchaseStatus(user)
		if (status.reason) error(403, status.reason)
		const settings = await inviteSettings()
		const amount = settings.price * 1e6 // micro-units

		if (amount) {
			const paid = await burn(
				f,
				user.id,
				amount,
				"Bought an invite",
				"/invites",
				{}
			)
			if (!paid.ok) error(402, `Couldn't pay for the invite: ${paid.msg}`)
		}
		try {
			const [key] = await db.query<string[]>(
				`(CREATE ONLY type::record("regKey", rand::id()) CONTENT {
					creator: $user,
					expiry: $expiry,
					kind: "purchase",
					usesLeft: 1,
				} RETURN VALUE record::id(id))`,
				{
					user: Record("user", user.id),
					expiry: settings.expiryDays
						? new Date(Date.now() + settings.expiryDays * 864e5)
						: undefined,
				}
			)
			return inviteCode(key)
		} catch (e) {
			if (amount)
				await mint(
					f,
					user.id,
					amount,
					"Refund for an invite that failed"
				)
			throw e
		}
	})

export type Invite = {
	id: string
	code: string
	created: Date
	expiry?: Date
	usesLeft: number
	kind?: string
	usedBy: string[]
}

/** A member's invites (their keys, and who used them), who invited them, and who they invited */
export async function memberInvites(user: string) {
	const [invites, inviter] = await db.query<
		[Omit<Invite, "code">[], { username?: string; kind?: string } | null]
	>(
		`SELECT record::id(id) AS id, created, expiry, usesLeft, kind,
			<-used<-user.username AS usedBy
		FROM regKey WHERE creator = $user ORDER BY created DESC;
		(SELECT creator.username AS username, kind FROM $user->used->regKey)[0];`,
		{ user: Record("user", user) }
	)
	return {
		invites: invites.map(i => ({ ...i, code: inviteCode(i.id) })),
		inviter,
	}
}

/** Who invited an account, if anyone did */
export async function invitedBy(user: string) {
	const [inviter] = await db.query<(string | null)[]>(
		"(SELECT VALUE creator.username FROM $user->used->regKey)[0]",
		{ user: Record("user", user) }
	)
	return inviter || undefined
}

export type TreeNode = {
	username: string
	created: Date
	level: number
	revoked: boolean
	banned: boolean
	/** how they joined */
	via: { inviter?: string; kind?: string; discordName?: string } | null
	children: TreeNode[]
}

/** Every account under whoever invited it; accounts with no inviter are roots */
export async function inviteTree() {
	const [rows] = await db.query<Omit<TreeNode, "children">[][]>(
		`SELECT username, created, permissionLevel AS level,
			invitesRevoked = true AS revoked,
			!!(SELECT 1 FROM moderation WHERE out = $parent.id AND active) AS banned,
			(SELECT creator.username AS inviter, kind, discordName
				FROM $parent->used->regKey)[0] AS via
		FROM user ORDER BY created`
	)
	const nodes = new Map<string, TreeNode>(
		rows.map(r => [r.username, { ...r, children: [] }])
	)
	const roots: TreeNode[] = []
	for (const node of nodes.values()) {
		const parent = node.via?.inviter && nodes.get(node.via.inviter)
		if (parent && parent !== node) parent.children.push(node)
		else roots.push(node)
	}
	return roots
}

/** Purchases this week and overall, and how many accounts joined with an invite */
export async function inviteStats() {
	const [boughtWeek, bought, joined] = await db.query<number[]>(
		`count(SELECT 1 FROM regKey WHERE kind = "purchase" AND created >= $week);
		count(SELECT 1 FROM regKey WHERE kind = "purchase");
		count(SELECT 1 FROM used);`,
		{ week: weekStart() }
	)
	return { boughtWeek, bought, joined }
}

/** Stops (or lets again) an account buying invites, disabling its unused ones */
export async function setRevoked(
	username: string,
	revoked: boolean,
	admin: { id: string; permissionLevel: number }
) {
	const [found] = await db.query<
		({ id: RecordId<"user">; permissionLevel: number } | null)[]
	>("(SELECT id, permissionLevel FROM user WHERE username = $username)[0]", {
		username,
	})
	if (!found) error(404, "No user has that username")
	// moderators can't revoke staff at their level or above
	if (
		admin.permissionLevel < 5 &&
		found.permissionLevel >= admin.permissionLevel
	)
		error(403, "You can't change invites for staff at your level or above")
	await db.query(
		`UPDATE $user SET invitesRevoked = $revoked;
		IF $revoked {
			UPDATE regKey SET usesLeft = 0 WHERE creator = $user AND usesLeft > 0;
		};
		fn::auditLog("Moderation", $note, $admin);`,
		{
			user: found.id,
			revoked,
			admin: Record("user", admin.id),
			note: `${revoked ? "Revoke" : "Restore"} invites for ${username}`,
		}
	)
}

// Applications

const hash = (code: string) =>
	createHash("sha256")
		.update(code.toUpperCase().replace(/[^A-Z0-9]/g, ""))
		.digest("hex")

/** Plain text: no control characters, and at most one blank line in a row */
const plainText = (text: string) =>
	text
		.replace(/\r\n?/g, "\n")
		.replace(/[^\P{Cc}\n]|[\p{Cf}\p{Co}]/gu, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim()

export const applicationSchema = type({
	username: usernameTest,
	about: "string <= 2000",
	contact: "string <= 200",
})

// one limit for the whole Site, as it can't tell visitors' IP addresses apart
const applying = { tokens: 20, at: Date.now() }
const maxPending = 200

/**
 * Files an application to join.
 * @returns The secret code the applicant checks it with.
 */
export async function apply(input: typeof applicationSchema.infer) {
	const settings = await inviteSettings()
	if (!settings.applications || settings.registration !== "invite")
		error(403, "Applications are closed")

	const about = plainText(input.about)
	const contact = plainText(input.contact).replace(/\s+/g, " ")
	if (about.length < 20)
		error(400, "Tell us a bit more: at least 20 characters")
	if (about.length > 1000) error(400, "Keep it under 1000 characters")

	const now = Date.now()
	applying.tokens = Math.min(
		20,
		applying.tokens + (now - applying.at) / 180e3
	)
	applying.at = now
	if (applying.tokens < 1)
		error(
			429,
			"Lots of people are applying right now. Try again in a few minutes."
		)

	const [pending, taken] = await db.query<[number, boolean]>(
		`count(SELECT 1 FROM application WHERE status = "pending");
		!!(SELECT 1 FROM user WHERE string::lowercase(username) = string::lowercase($username))
			OR !!(SELECT 1 FROM application WHERE status = "pending"
				AND string::lowercase(username) = string::lowercase($username));`,
		{ username: input.username }
	)
	if (pending >= maxPending)
		error(503, "There are too many applications waiting. Try again later.")
	if (taken)
		error(409, "That username is taken, or already has an application")
	applying.tokens--

	const code = randomCode(16) // 80 bits
	await db.query(
		`CREATE application CONTENT {
			about: $about,
			contact: $contact,
			tokenHash: $hash,
			username: $username,
		}`,
		{ about, contact, hash: hash(code), username: input.username }
	)
	return code
}

export type ApplicationStatus = {
	username: string
	created: Date
	status: "pending" | "approved" | "rejected"
	note: string
	invite: { code: string; expiry?: Date; used: boolean } | null
}

/** An application's state, for its applicant (by its code) */
export async function applicationStatus(code: string) {
	if (typeof code !== "string" || code.length > 40) return
	const [found] = await db.query<
		({
			username: string
			created: Date
			status: ApplicationStatus["status"]
			note: string
			key?: { id: string; expiry?: Date; usesLeft: number }
		} | null)[]
	>(
		`(SELECT username, created, status, note,
			(SELECT record::id(id) AS id, expiry, usesLeft FROM ONLY $parent.key) AS key
		FROM application WHERE tokenHash = $hash LIMIT 1)[0]`,
		{ hash: hash(code) }
	)
	if (!found) return
	const { key, ...rest } = found
	return {
		...rest,
		invite: key
			? {
					code: inviteCode(key.id),
					expiry: key.expiry,
					used: key.usesLeft < 1,
				}
			: null,
	} satisfies ApplicationStatus
}

export type Application = {
	id: string
	username: string
	about: string
	contact: string
	created: Date
	status: ApplicationStatus["status"]
	note: string
	reviewer?: string
	reviewed?: Date
	joined: boolean
}

/** Applications for staff: waiting ones first, then the latest reviewed */
export async function listApplications() {
	const [pending, reviewed] = await db.query<Application[][]>(
		`SELECT record::id(id) AS id, username, about, contact, created, status, note,
			false AS joined
		FROM application WHERE status = "pending" ORDER BY created;
		SELECT record::id(id) AS id, username, about, contact, created, status, note,
			reviewer.username AS reviewer, reviewed,
			(key.usesLeft ?? 1) < 1 AS joined
		FROM application WHERE status != "pending" ORDER BY reviewed DESC LIMIT 50;`
	)
	return { pending, reviewed }
}

/** Approves (making the applicant an invite) or rejects an application */
export async function reviewApplication(
	id: string,
	approve: boolean,
	note: string,
	reviewer: string
) {
	if (!/^[a-z0-9]{1,40}$/.test(id)) error(400, "Invalid application")
	const settings = await inviteSettings()
	const [, , done] = await db.query<unknown[]>(
		`LET $app = (SELECT * FROM ONLY $id WHERE status = "pending");
		LET $key = IF $app AND $approve {
			(CREATE ONLY type::record("regKey", rand::id()) CONTENT {
				creator: $reviewer,
				expiry: $expiry,
				kind: "application",
				usesLeft: 1,
			}).id
		};
		IF $app {
			UPDATE $id SET status = IF $approve { "approved" } ELSE { "rejected" },
				note = $note, reviewer = $reviewer, reviewed = time::now(), key = $key;
			fn::auditLog("Moderation", string::concat(
				IF $approve { "Approve" } ELSE { "Reject" },
				" the application from ", $app.username), $reviewer);
			RETURN true;
		};`,
		{
			id: Record("application", id),
			approve,
			note: plainText(note).slice(0, 500),
			reviewer: Record("user", reviewer),
			expiry: settings.expiryDays
				? new Date(Date.now() + settings.expiryDays * 864e5)
				: undefined,
		}
	)
	if (!done) error(404, "That application isn't waiting for review")
}
