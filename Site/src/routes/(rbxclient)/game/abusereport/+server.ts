import { requireServerKey } from "$lib/server/assetAuth"
import { userFromEngineId } from "$lib/server/engineUser"
import oneAtATime from "$lib/server/oneAtATime"
import { db, Record } from "$lib/server/surreal"
import latestPlayingQuery from "../join/aya/latestPlaying.surql"
import reportQuery from "./report.surql"

// In-game abuse reports (the Report tab of the in-game menu). The player's
// client sends the report to the gameserver, which adds the chat the reporter
// could see and posts it here as XML (Players:SetAbuseReportUrl in the host
// script). It becomes a report like those made on the website (Admin > Abuse
// reports): about the reported player, or about the place's owner for a
// report on the game.
//
//   <report userID="reporter" placeID="1" gameJobID="...">
//     <comment>AbuserID:0;Reason;description</comment>
//     <messages><message userID="1" guid="...">text</message>...</messages>
//   </report>

// the website's categories (routes/(legal)/report/reports.ts) for the reasons
// the in-game menus of 2013 to 2016 offer; others are kept as they are
const categories: { [reason: string]: string } = {
	Swearing: "Swearing",
	"Bad Words or Threats": "Swearing",
	Bullying: "Harassment or discrimination",
	"Rude or Mean Behavior": "Harassment or discrimination",
	Scamming: "Scamming",
	Dating: "Dating",
	"Talking about Dating": "Dating",
	"Cheating/Exploiting": "Exploiting",
	"Personal Question":
		"Personal information (displaying their own or asking for others')",
	"Personal Questions":
		"Personal information (displaying their own or asking for others')",
	"Asking Personal Questions":
		"Personal information (displaying their own or asking for others')",
	"Inappropriate Username": "Inappropriate content",
	"Bad Username": "Inappropriate content",
	"Inappropriate Content": "Inappropriate content",
	"Bad Model or Script": "Inappropriate content",
	"Offsite Link": "Spam",
	"Offsite Links": "Spam",
}

// what the 2016 menu sends when the description box wasn't touched
const placeholders = ["Short Description (Optional)", "(Optional)"]

const maxBody = 256 * 1024
const maxReports = 5 // per player in 10 minutes, with website reports

const named: { [entity: string]: string } = {
	lt: "<",
	gt: ">",
	amp: "&",
	quot: '"',
	apos: "'",
}

/**
 * Text from Aya's XML writer: it escapes markup characters and writes each
 * byte outside printable ASCII as &#N; (so UTF-8 comes one byte at a time),
 * or puts text with newlines in CDATA.
 */
function xmlText(raw: string) {
	const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(raw)
	if (cdata) return cdata[1]
	const encoder = new TextEncoder()
	const bytes: number[] = []
	const add = (part: Uint8Array) => {
		for (const byte of part) bytes.push(byte)
	}
	for (const part of raw.split(/(&#?\w+;)/)) {
		const numeric = /^&#(\d+);$/.exec(part)
		if (numeric) {
			const n = Number(numeric[1])
			if (n < 256) bytes.push(n)
			else add(encoder.encode(String.fromCodePoint(n)))
		} else if (/^&\w+;$/.test(part))
			add(encoder.encode(named[part.slice(1, -1)] ?? part))
		else add(encoder.encode(part))
	}
	return new TextDecoder().decode(new Uint8Array(bytes))
}

const attributes = (tag: string) =>
	Object.fromEntries(
		Array.from(tag.matchAll(/(\w+)="([^"]*)"/g), ([, name, value]) => [
			name,
			xmlText(value),
		])
	)

/** The report, or nothing if it isn't one */
function parse(xml: string) {
	const root = /<report\b([^>]*)>/.exec(xml)
	const comment = /<comment>([\s\S]*?)<\/comment>/.exec(xml)
	if (!root || !comment) return
	const { userID, placeID } = attributes(root[1])

	// the gameserver puts the reported player first, the client's
	// "reason;description" after it
	const fields = /^AbuserID:(\d+);([^;]*);?([\s\S]*)$/.exec(
		xmlText(comment[1])
	)
	if (!fields) return

	return {
		reporter: Number(userID),
		place: Number(placeID),
		abuser: Number(fields[1]),
		reason: fields[2].trim().slice(0, 60),
		description: fields[3].trim().slice(0, 500),
		messages: Array.from(
			xml.matchAll(/<message\b([^>]*)>([\s\S]*?)<\/message>/g),
			([, tag, text]) => ({
				userId: Number(attributes(tag).userID),
				text: xmlText(text).slice(0, 300),
			})
		).slice(-50),
	}
}

async function placeOwner(place: number) {
	const [[owner]] = await db.query<(string | undefined)[][]>(
		"SELECT VALUE record::id(id) FROM $place<-ownsPlace<-user",
		{ place: Record("place", place) }
	)
	return owner
}

async function name(userId: number) {
	return (await userFromEngineId(userId))?.username ?? `#${userId}`
}

export async function POST({ request }) {
	requireServerKey(request)

	const ok = new Response("OK", { headers: { "Content-Type": "text/plain" } })
	const body = await request.text()
	const report = body.length <= maxBody ? parse(body) : undefined
	if (
		!report ||
		!Number.isSafeInteger(report.place) ||
		report.place < 1 ||
		report.place > 999_999_999_999
	)
		return new Response("Invalid report", { status: 400 })

	// players who aren't in this game can't report in it
	const reporter = await userFromEngineId(report.reporter)
	if (!reporter) return ok
	const [, playing] = await db.query<unknown[]>(latestPlayingQuery, {
		user: Record("user", reporter.id),
		place: Record("place", report.place),
	})
	if (!playing) return ok

	// a report on the game is about its owner
	const reportee = report.abuser
		? (await userFromEngineId(report.abuser))?.id
		: await placeOwner(report.place)
	if (!reportee || reportee === reporter.id) return ok

	const description = placeholders.includes(report.description)
		? ""
		: report.description
	// the game's own messages come tagged [[game]] by the gameserver
	const chat = await Promise.all(
		report.messages.map(async m =>
			m.userId ? `${await name(m.userId)}: ${m.text}` : m.text
		)
	)
	const note = [
		`Reported in game${report.abuser ? "" : " (the game)"}: ${report.reason}`,
		...(description ? [description] : []),
		...(chat.length ? ["", "Chat the reporter could see:", ...chat] : []),
	].join("\n")

	await oneAtATime(`report:${reporter.id}`, () =>
		db.query(reportQuery, {
			reporter: Record("user", reporter.id),
			reportee: Record("user", reportee),
			category: categories[report.reason] ?? (report.reason || "Other"),
			note,
			url: `/place/${report.place}`,
			maxReports,
		})
	)
	return ok
}
