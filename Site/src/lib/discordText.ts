// User-written text for Discord embeds (lib/server/discordModerationWebhook.ts)

/**
 * Text shown in Discord exactly as written: every ASCII punctuation mark is
 * escaped, so it can't make Markdown, masked or bare links, mentions,
 * timestamps or headings. Cut to fit `max` characters (escapes included),
 * and never empty, as Discord refuses empty embed fields.
 */
export default function discordText(text: string, max = 1024) {
	const chars = Array.from(text.trim(), c =>
		/^[!-/:-@[-`{-~]$/.test(c) ? `\\${c}` : c
	)
	let out = chars.join("")
	if (out.length <= max) return out || "-"

	out = ""
	for (const c of chars) {
		if (out.length + c.length > max - 1) break
		out += c
	}
	return `${out}…`
}
