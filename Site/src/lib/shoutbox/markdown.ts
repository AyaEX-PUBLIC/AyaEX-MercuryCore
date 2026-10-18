// Shoutbox markdown: a small subset, parsed into nodes that ShoutText.svelte
// renders as elements, never as HTML. There are no headings, images or masked
// links, so a message can't be huge, embed anything, or hide where a link goes.
//
//   **bold**  *italic* or _italic_  __underline__  ~~strike~~  ||spoiler||
//   `code`  > quote  https://links  @mentions  \*escaped

export type Node =
	| string
	| { t: "b" | "i" | "u" | "s" | "spoiler"; c: Node[] }
	| { t: "code"; v: string }
	| { t: "link"; href: string; v: string }
	| { t: "mention"; v: string }

/** A run of lines that are either all quoted or all not */
export type Block = { quote: boolean; c: Node[] }

// how deep formatting can nest, e.g. bold inside a spoiler inside italics
const maxDepth = 4

const delimiters = [
	["||", "spoiler"],
	["**", "b"],
	["__", "u"],
	["~~", "s"],
	["*", "i"],
	["_", "i"],
] as const

const escapable = /[\\`*_~|>@:]/
const word = /[\p{L}\p{N}_]/u
const space = /\s/
const mention = /@([A-Za-z0-9_]{3,21})(?![A-Za-z0-9_])/y
const link = /https?:\/\/[^\s<>"'`]+/iy
const linkTrailing = /[.,!?:;'"\])}*_~|]/

const isWord = (c: string | undefined) => !!c && word.test(c)

/** Length of the run of c starting at i */
function runLength(s: string, i: number, c: string) {
	let n = 0
	while (s[i + n] === c) n++
	return n
}

/** Where the delimiter opened at i is closed, or -1 */
function findClose(s: string, i: number, d: string) {
	const flanking = d === "*" || d === "_"
	const start = i + d.length
	if (flanking && space.test(s[start] || " ")) return -1

	for (let j = start + 1; j < s.length; ) {
		const run = runLength(s, j, d[0])
		if (!run) {
			j++
			continue
		}
		// in a run like ***, close on its last delimiter
		const close =
			d.length === 2
				? run >= 2 && j + run - 2
				: (run === 1 || run >= 3) && j + run - 1
		if (
			close !== false &&
			!(flanking && space.test(s[close - 1])) &&
			!(d === "_" && isWord(s[close + 1]))
		)
			return close
		j += run
	}
	return -1
}

/** A bare http(s) link at i, without the punctuation that usually follows one */
function matchLink(s: string, i: number) {
	link.lastIndex = i
	let text = link.exec(s)?.[0]
	if (!text) return

	while (linkTrailing.test(text.at(-1) || "")) {
		// keep a closing bracket that matches one in the link, as on Wikipedia
		if (
			text.endsWith(")") &&
			text.split("(").length >= text.split(")").length
		)
			break
		text = text.slice(0, -1)
	}

	let url: URL
	try {
		url = new URL(text)
	} catch {
		return
	}
	// "https://example.com@evil.example" goes to evil.example
	if (url.username || url.password || text.length > 512) return

	// show lookalike international domains as their real (punycode) address
	const shown = url.hostname.includes("xn--") ? url.href : text
	return {
		node: { t: "link", href: url.href, v: shown } as Node,
		length: text.length,
	}
}

function inline(s: string, depth: number): Node[] {
	const out: Node[] = []
	let text = ""
	const push = (node: Node, next: number) => {
		if (text) out.push(text)
		text = ""
		out.push(node)
		return next
	}

	let i = 0
	scan: while (i < s.length) {
		const c = s[i]
		const atWordStart = !isWord(s[i - 1])

		if (c === "\\" && escapable.test(s[i + 1] || "")) {
			text += s[i + 1]
			i += 2
			continue
		}

		if (c === "`") {
			// `code`, or ``code with ` in it``
			const ticks = runLength(s, i, "`")
			for (let j = s.indexOf("`", i + ticks); j !== -1; ) {
				const run = runLength(s, j, "`")
				if (run === ticks) {
					const v = s.slice(i + ticks, j)
					if (v.trim()) {
						i = push({ t: "code", v }, j + ticks)
						continue scan
					}
					break
				}
				j = s.indexOf("`", j + run)
			}
			text += "`".repeat(ticks)
			i += ticks
			continue
		}

		if ((c === "h" || c === "H") && atWordStart) {
			const found = matchLink(s, i)
			if (found) {
				i = push(found.node, i + found.length)
				continue
			}
		}

		if (c === "@" && atWordStart) {
			mention.lastIndex = i
			const found = mention.exec(s)
			if (found) {
				i = push({ t: "mention", v: found[1] }, i + found[0].length)
				continue
			}
		}

		if (depth < maxDepth)
			for (const [d, t] of delimiters) {
				if (!s.startsWith(d, i)) continue
				// snake_case_names aren't italic
				if (d === "_" && !atWordStart) continue
				const close = findClose(s, i, d)
				if (close === -1) continue
				const c = inline(s.slice(i + d.length, close), depth + 1)
				i = push({ t, c }, close + d.length)
				continue scan
			}

		text += c
		i++
	}
	if (text) out.push(text)
	return out
}

/** Parses a message into blocks of formatted text */
export default function parse(text: string): Block[] {
	const blocks: { quote: boolean; lines: string[] }[] = []
	for (const line of text.split("\n")) {
		// "> quote", but not ">:)"
		const quote = line === ">" || line.startsWith("> ")
		const content = quote ? line.slice(2) : line
		const last = blocks.at(-1)
		if (last?.quote === quote) last.lines.push(content)
		else blocks.push({ quote, lines: [content] })
	}
	return blocks.map(({ quote, lines }) => ({
		quote,
		c: inline(lines.join("\n"), 0),
	}))
}

/** Plain text of a message, without formatting, e.g. for notifications */
export function plain(nodes: Node[]): string {
	return nodes
		.map(n =>
			typeof n === "string"
				? n
				: "c" in n
					? n.t === "spoiler"
						? "[spoiler]"
						: plain(n.c)
					: n.t === "mention"
						? `@${n.v}`
						: n.v
		)
		.join("")
}
