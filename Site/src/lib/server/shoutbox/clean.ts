// Cleans up shoutbox messages before they're stored. Messages are plain text
// with a little markdown (lib/shoutbox/markdown.ts), so this only removes what
// would make them unreadable or annoying: zalgo, invisible and
// direction-changing characters, huge glyphs, styled "fancy" letters, long runs
// of one character, and walls of emoji or lines.

import filter from "$lib/server/filter"
import { shortcodes } from "$lib/shoutbox/emoji"
import {
	graphemes,
	isEmoji,
	maxEmoji,
	maxLength,
	maxLines,
} from "$lib/shoutbox/limits"

// combining accents on one character (Vietnamese and Thai need up to 2)
const maxMarks = 3
// the same character in a row, e.g. "!!!!!!!!!!"
const maxRepeat = 10

// Control characters (newlines are handled separately), private use,
// direction overrides and isolates, zero-width and blank "filler" characters,
// variation selectors other than the emoji ones, and glyphs much bigger than
// a line (cuneiform, ﷽, ⸺/⸻)
const removed =
	/[\p{Cc}\p{Co}\u00AD\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\u2800\u2E3A\u2E3B\u3164\uFDFD\uFEFF\uFFA0\uFFF0-\uFFFB\u{12000}-\u{1254F}\u{13430}-\u{1345F}\u{1D173}-\u{1D17A}]|[\uFE00-\uFE0D]|[\u{E0100}-\u{E01EF}]/gu
// tag characters are only allowed in subdivision flags, like Scotland's
const tags = /(\u{1F3F4}?)([\u{E0000}-\u{E007F}]+)/gu
const flagTags = /^[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,6}\u{E007F}$/u
// 𝐛𝐨𝐥𝐝, 𝓈𝒸𝓇𝒾𝓅𝓉 and ｆｕｌｌｗｉｄｔｈ letters, which also dodge the word filter
const styled = /[\u{1D400}-\u{1D7FF}\uFF01-\uFF5E]/gu
const marks = /\p{M}+/gu
const visible = /[\p{L}\p{N}\p{P}\p{S}]/u

/** Keeps a few non-spacing accents on a character, and drops enclosing marks */
function limitMarks(run: string) {
	let nonSpacing = 0
	let out = ""
	for (const c of run) {
		if (/\p{Mc}/u.test(c)) out += c
		else if (/\p{Me}/u.test(c)) {
			if (c === "\u20E3") out += c // keycap, as in 1️⃣
		} else if (++nonSpacing <= maxMarks) out += c
	}
	return out
}

function limitRepeats(line: string) {
	let out = ""
	let previous = ""
	let run = 0
	for (const g of graphemes(line)) {
		run = g === previous ? run + 1 : 1
		previous = g
		if (run <= maxRepeat) out += g
	}
	return out
}

/** :joy: to 😂, except in `code` */
const replaceShortcodes = (text: string) =>
	text
		.split(/(`+[^`]*`+)/)
		.map((part, i) =>
			i % 2
				? part
				: part.replace(
						/:([a-z0-9_+-]{1,32}):/g,
						(code, name) => shortcodes.get(name) || code
					)
		)
		.join("")

const cleanLine = (line: string) =>
	limitRepeats(
		line
			.replace(/\t/g, " ")
			.replace(removed, "")
			.replace(tags, (_, flag, t) =>
				flag && flagTags.test(t) ? flag + t : flag
			)
			.replace(styled, c => c.normalize("NFKC"))
			.replace(/\p{Zs}+/gu, " ")
			.replace(marks, limitMarks)
	).trimEnd()

export type Cleaned = { text: string } | { error: string }

/**
 * Cleans a message and checks it against the shoutbox limits.
 * @returns The text to store, or an error to show the sender.
 * @example
 * const cleaned = clean(input)
 * if ("error" in cleaned) error(400, cleaned.error)
 */
export default function clean(input: string): Cleaned {
	const lines = replaceShortcodes(
		input
			.toWellFormed()
			.normalize("NFC")
			.replace(/\r\n?|[\u0085\u2028\u2029]/g, "\n")
	)
		.split("\n")
		.map(cleanLine)

	// no more than one blank line in a row, and none at the start or end
	const kept: string[] = []
	for (const line of lines)
		if (line.trim() || (kept.length && kept.at(-1)?.trim())) kept.push(line)
	while (kept.length && !kept.at(-1)?.trim()) kept.pop()

	const text = filter(kept.join("\n").trim())
	if (!visible.test(text)) return { error: "Your message is empty" }
	if (kept.length > maxLines)
		return { error: `Messages can have at most ${maxLines} lines` }

	const chars = graphemes(text)
	if (chars.length > maxLength)
		return { error: `Messages can be at most ${maxLength} characters long` }
	if (chars.filter(isEmoji).length > maxEmoji)
		return { error: `Messages can have at most ${maxEmoji} emoji` }

	return { text }
}
