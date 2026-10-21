// A small, safe subset of Markdown, for news posts. Text is parsed to a tree
// that components/Markdown.svelte renders as elements: there is no raw HTML in
// the output, ever, and links and images only get web or site-relative URLs.
//
// Supported: paragraphs, headings (# to ######), emphasis (*a*, _a_, **a**,
// ~~a~~), `code`, fenced code, links, images, bare and <angle> links, block
// quotes, bullet, numbered and task lists (nested), horizontal rules, tables.
//
// Everything here moves forward through the text, and the few places that
// search ahead are capped, so unclosed or nested markers can't make parsing
// slow.

export type Inline =
	| string
	| { t: "strong" | "em" | "del"; c: Inline[] }
	| { t: "code"; v: string }
	| { t: "link"; href: string; title?: string; c: Inline[] }
	| { t: "img"; src: string; alt: string; title?: string }
	| { t: "br" }

export type Align = "left" | "center" | "right" | null

export type Block =
	| { t: "p"; c: Inline[] }
	| { t: "h"; level: 1 | 2 | 3 | 4 | 5 | 6; c: Inline[] }
	| { t: "quote"; c: Block[] }
	| { t: "list"; ordered: boolean; start: number; items: Item[] }
	| { t: "code"; lang: string; v: string }
	| { t: "hr" }
	| { t: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] }

export type Item = { c: Block[]; checked?: boolean }

const MAX_DEPTH = 6 // nested quotes and lists
const MAX_DELIMS = 2000 // emphasis markers considered in one paragraph
const MAX_URL = 2000

const punct = /[!-/:-@[-`{-~\p{P}\p{S}]/u
const asciiPunct = /[!-/:-@[-`{-~]/
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c)
const isPunct = (c: string | undefined) => c !== undefined && punct.test(c)

/**
 * A URL that is safe to put in a link or image, or null. Links may be web
 * addresses, mail addresses, site paths and #anchors; images only https
 * addresses and site paths.
 */
export function safeUrl(raw: string, image = false) {
	const url = raw.trim()
	if (!url || url.length > MAX_URL) return null
	// no whitespace, control characters, quotes, angle brackets or backslashes
	for (const c of url) {
		const n = c.charCodeAt(0)
		if (n <= 32 || n === 127 || /[\s<>"\\]/.test(c)) return null
	}
	if (/^https:\/\//i.test(url)) return url
	if (!image && /^(http:\/\/|mailto:)/i.test(url)) return url
	if (url.startsWith("/") && !url.startsWith("//")) return url
	if (!image && url.startsWith("#")) return url
	return null
}

// ---- inline

type Delim = { d: true; ch: string; n: number; open: boolean; close: boolean }
type Marker = { m: true; img: boolean; active: boolean }
type Tok = Inline | Delim | Marker

const isDelim = (t: Tok | undefined): t is Delim =>
	typeof t === "object" && "d" in t
const isMarker = (t: Tok | undefined): t is Marker =>
	typeof t === "object" && "m" in t

/** Joins neighbouring strings, and turns leftover markers into text */
function flatten(list: Tok[]) {
	const out: Inline[] = []
	const text = (s: string) => {
		if (!s) return
		if (typeof out[out.length - 1] === "string") out[out.length - 1] += s
		else out.push(s)
	}
	for (const t of list)
		if (typeof t === "string") text(t)
		else if (isDelim(t)) text(t.ch.repeat(t.n))
		else if (isMarker(t)) text(t.img ? "![" : "[")
		else out.push(t)
	return out
}

/** Pairs up emphasis markers, innermost first */
function emphasis(list: Tok[]) {
	const items: Tok[] = []
	for (const tok of list) {
		if (!isDelim(tok)) {
			items.push(tok)
			continue
		}
		let n = tok.n
		if (tok.close)
			while (n > 0) {
				let o = -1
				for (let k = items.length - 1; k >= 0; k--) {
					const it = items[k]
					if (
						isDelim(it) &&
						it.ch === tok.ch &&
						it.open &&
						it.n > 0
					) {
						o = k
						break
					}
				}
				if (o < 0) break
				const opener = items[o] as Delim
				const use = opener.n >= 2 && n >= 2 ? 2 : tok.ch === "~" ? 0 : 1
				if (!use) break

				const c = flatten(items.splice(o + 1))
				const t = use === 2 ? (tok.ch === "~" ? "del" : "strong") : "em"
				opener.n -= use
				n -= use
				items.push({ t, c })
			}
		if (n > 0) items.push({ ...tok, n })
	}
	return flatten(items)
}

/** The plain text of some inline content */
export const plain = (list: Inline[]): string =>
	list
		.map(n =>
			typeof n === "string"
				? n
				: n.t === "code"
					? n.v
					: n.t === "img"
						? n.alt
						: n.t === "br"
							? " "
							: plain(n.c)
		)
		.join("")

/** (destination "title") after a link's ], starting at the opening paren */
function destination(src: string, at: number) {
	let i = at + 1
	const skip = () => {
		while (i < src.length && (src[i] === " " || src[i] === "\n")) i++
	}
	skip()
	let href = ""
	if (src[i] === "<") {
		let end = i + 1
		while (
			end < src.length &&
			end - i <= MAX_URL &&
			src[end] !== ">" &&
			src[end] !== "\n"
		)
			end++
		if (src[end] !== ">") return null
		href = src.slice(i + 1, end)
		i = end + 1
	} else {
		let depth = 0
		const start = i
		while (i < src.length && i - start <= MAX_URL) {
			const c = src[i]
			if (c === "\\" && asciiPunct.test(src[i + 1] ?? "")) i += 2
			else if (c === "(") {
				depth++
				i++
			} else if (c === ")") {
				if (depth === 0) break
				depth--
				i++
			} else if (c === " " || c === "\n") break
			else i++
		}
		href = src.slice(start, i).replace(/\\([!-/:-@[-`{-~])/g, "$1")
	}

	skip()
	let title: string | undefined
	const q = src[i]
	if (q === '"' || q === "'" || q === "(") {
		const close = q === "(" ? ")" : q
		let j = i + 1
		while (j < src.length && j - i <= 400 && src[j] !== close) {
			if (src[j] === "\\") j++
			j++
		}
		if (src[j] !== close) return null
		title = src.slice(i + 1, j).replace(/\\([!-/:-@[-`{-~])/g, "$1")
		i = j + 1
		skip()
	}
	if (src[i] !== ")") return null
	return { href, title, end: i + 1 }
}

export function inline(src: string): Inline[] {
	const toks: Tok[] = []
	const brackets: number[] = [] // where the open [ markers are in toks
	const failedTicks = new Set<number>()
	let buf = ""
	let delims = 0
	let gt = src.indexOf(">") // the next > at or after the cursor, found once
	const flush = () => {
		if (buf) toks.push(buf)
		buf = ""
	}

	let i = 0
	while (i < src.length) {
		const c = src[i]

		if (c === "\\") {
			const next = src[i + 1]
			if (next === "\n") {
				flush()
				toks.push({ t: "br" })
				i += 2
			} else if (next && asciiPunct.test(next)) {
				buf += next
				i += 2
			} else {
				buf += c
				i++
			}
			continue
		}

		if (c === "\n") {
			let k = buf.length
			while (k > 0 && buf[k - 1] === " ") k--
			const hard = buf.length - k >= 2
			buf = buf.slice(0, k)
			if (hard) {
				flush()
				toks.push({ t: "br" })
			} else buf += " "
			i++
			while (src[i] === " ") i++
			continue
		}

		if (c === "`") {
			let n = 1
			while (src[i + n] === "`") n++
			if (!failedTicks.has(n)) {
				let found = -1
				for (let at = i + n; at < src.length; ) {
					const p = src.indexOf("`", at)
					if (p < 0) break
					let m = 1
					while (src[p + m] === "`") m++
					if (m === n) {
						found = p
						break
					}
					at = p + m
				}
				if (found >= 0) {
					let v = src.slice(i + n, found).replace(/\n/g, " ")
					if (
						v.length > 2 &&
						v.startsWith(" ") &&
						v.endsWith(" ") &&
						v.trim()
					)
						v = v.slice(1, -1)
					flush()
					toks.push({ t: "code", v })
					i = found + n
					continue
				}
				failedTicks.add(n) // nothing later can close it either
			}
			buf += "`".repeat(n)
			i += n
			continue
		}

		if (c === "[" || (c === "!" && src[i + 1] === "[")) {
			const img = c === "!"
			flush()
			brackets.push(toks.length)
			toks.push({ m: true, img, active: true })
			i += img ? 2 : 1
			continue
		}

		if (c === "]") {
			const at = brackets.pop()
			const marker = at === undefined ? undefined : toks[at]
			if (at === undefined || !isMarker(marker)) {
				buf += c
				i++
				continue
			}
			const dest =
				marker.active && src[i + 1] === "("
					? destination(src, i + 1)
					: null
			if (!dest) {
				// not a link: the [ was just text
				toks[at] = marker.img ? "![" : "["
				buf += c
				i++
				continue
			}

			flush()
			const content = emphasis(toks.splice(at + 1))
			toks.pop() // the marker
			if (marker.img) {
				const src = safeUrl(dest.href, true)
				const alt = plain(content)
				if (src) toks.push({ t: "img", src, alt, title: dest.title })
				else toks.push(alt)
			} else {
				const href = safeUrl(dest.href)
				if (href)
					toks.push({
						t: "link",
						href,
						title: dest.title,
						c: content,
					})
				else toks.push(...content)
				// links don't nest: earlier [ markers can no longer start one
				for (const k of brackets) {
					const earlier = toks[k]
					if (isMarker(earlier) && !earlier.img)
						earlier.active = false
				}
			}
			i = dest.end
			continue
		}

		if (c === "<") {
			if (gt !== -1 && gt <= i) gt = src.indexOf(">", i + 1)
			const end = gt
			if (end > 0 && end - i <= MAX_URL) {
				const url = src.slice(i + 1, end)
				if (
					/^(https?:\/\/|mailto:)[^\s<>]+$/i.test(url) &&
					safeUrl(url)
				) {
					flush()
					toks.push({
						t: "link",
						href: url,
						c: [url.replace(/^mailto:/i, "")],
					})
					i = end + 1
					continue
				}
			}
			buf += c
			i++
			continue
		}

		if (c === "*" || c === "_" || c === "~") {
			let n = 1
			while (src[i + n] === c) n++
			if ((c === "~" && n !== 2) || delims >= MAX_DELIMS) {
				buf += c.repeat(n)
				i += n
				continue
			}
			const prev = src[i - 1]
			const next = src[i + n]
			const left =
				!isSpace(next) &&
				(!isPunct(next) || isSpace(prev) || isPunct(prev))
			const right =
				!isSpace(prev) &&
				(!isPunct(prev) || isSpace(next) || isPunct(next))
			const word = c === "_"
			flush()
			toks.push({
				d: true,
				ch: c,
				n,
				open: left && (!word || !right || isPunct(prev)),
				close: right && (!word || !left || isPunct(next)),
			})
			delims++
			i += n
			continue
		}

		if (
			c === "h" &&
			brackets.length === 0 &&
			(src.startsWith("http://", i) || src.startsWith("https://", i)) &&
			(i === 0 || !/[\p{L}\p{N}]/u.test(src[i - 1]))
		) {
			let end = i
			while (
				end < src.length &&
				end - i <= MAX_URL &&
				!/[\s<]/.test(src[end])
			)
				end++
			// punctuation after the address belongs to the sentence
			while (end > i) {
				const last = src[end - 1]
				if (/[.,;:!?'"*_~]/.test(last)) end--
				else if (last === ")") {
					const part = src.slice(i, end)
					if (part.split(")").length > part.split("(").length) end--
					else break
				} else break
			}
			const url = src.slice(i, end)
			if (url.length > 8 && safeUrl(url)) {
				flush()
				toks.push({ t: "link", href: url, c: [url] })
				i = end
				continue
			}
		}

		buf += c
		i++
	}
	flush()
	return emphasis(toks)
}

// ---- blocks

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/
const HEADING = /^ {0,3}(#{1,6})(?: +(.*))?$/

function isHr(line: string) {
	const t = line.trim()
	if (t.length < 3 || line.length - line.trimStart().length > 3) return false
	const ch = t[0]
	if (ch !== "-" && ch !== "*" && ch !== "_") return false
	let n = 0
	for (const c of t)
		if (c === ch) n++
		else if (c !== " ") return false
	return n >= 3
}

type Marker2 = {
	ordered: boolean
	ch: string
	num: number
	/** Where an item's text starts, which later lines of it are indented to */
	content: number
	rest: string
}

function listMarker(line: string): Marker2 | null {
	let i = 0
	while (line[i] === " ") i++
	if (i > 3) return null
	const c = line[i]
	let ordered = false
	let num = 0
	let end = i + 1
	if (c !== "-" && c !== "*" && c !== "+") {
		let j = i
		while (j < line.length && line[j] >= "0" && line[j] <= "9" && j - i < 9)
			j++
		if (j === i || (line[j] !== "." && line[j] !== ")")) return null
		ordered = true
		num = Number(line.slice(i, j))
		end = j + 1
	}
	if (end < line.length && line[end] !== " ") return null
	let gap = 0
	while (line[end + gap] === " ") gap++
	// an item that starts empty, or with indented code, has its text 1 space in
	const used = end + gap >= line.length || gap > 4 ? 1 : gap
	return {
		ordered,
		ch: ordered ? line[end - 1] : c,
		num,
		content: end + used,
		rest: line.slice(end + used),
	}
}

/** Whether a line starts something other than a paragraph */
function startsBlock(line: string) {
	if (FENCE.test(line) || HEADING.test(line) || isHr(line)) return true
	if (/^ {0,3}>/.test(line)) return true
	const m = listMarker(line)
	return !!m && m.rest.trim() !== "" && (!m.ordered || m.num === 1)
}

function cells(line: string) {
	let s = line.trim()
	if (!s.includes("|")) return null
	if (s.startsWith("|")) s = s.slice(1)
	if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1)
	const out: string[] = []
	let cur = ""
	for (let k = 0; k < s.length; k++) {
		if (s[k] === "\\" && s[k + 1] === "|") {
			cur += "|"
			k++
		} else if (s[k] === "|") {
			out.push(cur.trim())
			cur = ""
		} else cur += s[k]
	}
	out.push(cur.trim())
	return out
}

function alignment(cell: string): Align | undefined {
	if (!/^:?-+:?$/.test(cell)) return undefined
	const l = cell.startsWith(":")
	const r = cell.endsWith(":")
	return l && r ? "center" : r ? "right" : l ? "left" : null
}

function blocks(lines: string[], depth: number): Block[] {
	const out: Block[] = []
	const nested = depth < MAX_DEPTH // too deep: only paragraphs, code and rules
	let i = 0
	while (i < lines.length) {
		const line = lines[i]
		if (!line.trim()) {
			i++
			continue
		}

		const fence = FENCE.exec(line)
		if (fence && !(fence[2][0] === "`" && fence[3].includes("`"))) {
			const [, , marks, info] = fence
			const v: string[] = []
			i++
			while (i < lines.length) {
				const close = /^ {0,3}(`{3,}|~{3,}) *$/.exec(lines[i])
				if (
					close &&
					close[1][0] === marks[0] &&
					close[1].length >= marks.length
				)
					break
				v.push(lines[i])
				i++
			}
			i++ // the closing fence
			out.push({
				t: "code",
				lang: info.trim().split(/\s+/)[0] || "",
				v: v.join("\n"),
			})
			continue
		}

		const heading = HEADING.exec(line)
		if (heading) {
			let text = (heading[2] || "").trim()
			// a closing run of #s is decoration
			let end = text.length
			while (end > 0 && text[end - 1] === "#") end--
			if (end < text.length && (end === 0 || text[end - 1] === " "))
				text = text.slice(0, end).trimEnd()
			out.push({
				t: "h",
				level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
				c: inline(text),
			})
			i++
			continue
		}

		if (isHr(line)) {
			out.push({ t: "hr" })
			i++
			continue
		}

		if (nested && /^ {0,3}>/.test(line)) {
			const inner: string[] = []
			while (i < lines.length) {
				const l = lines[i]
				if (/^ {0,3}>/.test(l)) inner.push(l.replace(/^ {0,3}> ?/, ""))
				else if (l.trim() && inner.at(-1)?.trim() && !startsBlock(l))
					inner.push(l) // a paragraph carrying on without its >
				else break
				i++
			}
			out.push({ t: "quote", c: blocks(inner, depth + 1) })
			continue
		}

		const first = nested ? listMarker(line) : null
		if (first) {
			const items: Item[] = []
			while (i < lines.length) {
				const m = listMarker(lines[i])
				if (!m || m.ordered !== first.ordered || m.ch !== first.ch)
					break

				const body = [m.rest]
				i++
				while (i < lines.length) {
					const l = lines[i]
					if (!l.trim()) {
						// blank lines belong to the item if it carries on, indented
						let j = i + 1
						while (j < lines.length && !lines[j].trim()) j++
						if (j < lines.length && indent(lines[j]) >= m.content) {
							for (; i < j; i++) body.push("")
							continue
						}
						break
					}
					if (indent(l) >= m.content) {
						body.push(l.slice(m.content))
						i++
					} else if (
						body.at(-1)?.trim() &&
						!startsBlock(l) &&
						!listMarker(l)
					) {
						body.push(l.trimStart()) // a paragraph carrying on, unindented
						i++
					} else break
				}

				let checked: boolean | undefined
				const task = /^\[([ xX])\] +/.exec(body[0])
				if (task) {
					checked = task[1] !== " "
					body[0] = body[0].slice(task[0].length)
				}
				items.push({ c: blocks(body, depth + 1), checked })

				// a blank line between items doesn't end the list
				let j = i
				while (j < lines.length && !lines[j].trim()) j++
				const after = j < lines.length ? listMarker(lines[j]) : null
				if (
					after &&
					after.ordered === first.ordered &&
					after.ch === first.ch
				)
					i = j
			}
			out.push({
				t: "list",
				ordered: first.ordered,
				start: first.num,
				items,
			})
			continue
		}

		if (nested && i + 1 < lines.length) {
			const head = cells(line)
			const rule = cells(lines[i + 1])
			const align = rule?.map(alignment)
			if (
				head &&
				rule &&
				head.length === rule.length &&
				align?.every(a => a !== undefined)
			) {
				const rows: Inline[][][] = []
				i += 2
				while (
					i < lines.length &&
					lines[i].trim() &&
					lines[i].includes("|")
				) {
					const row = cells(lines[i]) as string[]
					rows.push(head.map((_, k) => inline(row[k] ?? "")))
					i++
				}
				out.push({
					t: "table",
					align: align as Align[],
					head: head.map(inline),
					rows,
				})
				continue
			}
		}

		// a paragraph: up to a blank line or the start of something else
		const para = [line.trimStart()]
		i++
		while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
			para.push(lines[i].trimStart())
			i++
		}
		out.push({ t: "p", c: inline(para.join("\n").trimEnd()) })
	}
	return out
}

const indent = (line: string) => line.length - line.trimStart().length

/** The blocks of a Markdown text */
export function parse(md: string): Block[] {
	return blocks(
		md.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n"),
		0
	)
}

/** A short plain-text summary of some Markdown: its first paragraphs */
export function excerpt(md: string, max = 220) {
	const parts: string[] = []
	let length = 0
	const walk = (list: Block[]) => {
		for (const b of list) {
			if (length >= max) return
			let text = ""
			if (b.t === "p") text = plain(b.c)
			else if (b.t === "quote") walk(b.c)
			else if (b.t === "list") for (const item of b.items) walk(item.c)
			if (text.trim()) {
				parts.push(text.replace(/\s+/g, " ").trim())
				length += parts.at(-1)?.length ?? 0
			}
		}
	}
	walk(parse(md))

	const all = parts.join(" ")
	if (all.length <= max) return all
	const cut = all.slice(0, max)
	return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd()}…`
}
