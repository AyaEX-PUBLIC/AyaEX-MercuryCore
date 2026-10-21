import { describe, expect, test } from "bun:test"
import {
	excerpt,
	type Block,
	type Inline,
	parse,
	plain,
	safeUrl,
} from "./markdown"

const inlines = (md: string) => (parse(md)[0] as { c: Inline[] }).c

describe("blocks", () => {
	test("paragraphs, headings and rules", () => {
		const b = parse("# Title\n\nOne\ntwo\n\n## Sub ##\n\n---\n\nLast")
		expect(b.map(x => x.t)).toEqual(["h", "p", "h", "hr", "p"])
		expect((b[0] as { level: number }).level).toBe(1)
		expect((b[2] as { c: Inline[] }).c).toEqual(["Sub"])
		expect((b[1] as { c: Inline[] }).c).toEqual(["One two"])
	})

	test("a hash without a space is text", () => {
		expect(parse("#nope")[0]).toEqual({ t: "p", c: ["#nope"] })
	})

	test("fenced code keeps its text, with or without a closing fence", () => {
		expect(parse("```ts\nlet a = *1*\n```")[0]).toEqual({
			t: "code",
			lang: "ts",
			v: "let a = *1*",
		})
		expect(parse("~~~\nopen")[0]).toEqual({
			t: "code",
			lang: "",
			v: "open",
		})
		// a fence needs 3 or more, and ``` can't be followed by another ` on its line
		expect(parse("``` `x`")[0].t).toBe("p")
	})

	test("lists: bullets, numbers from their start, tasks and nesting", () => {
		const b = parse(
			"- a\n- b\n  - c\n  - d\n- [x] done\n- [ ] todo\n\n3. x\n4. y"
		)
		const list = b[0] as Extract<Block, { t: "list" }>
		expect(list.ordered).toBe(false)
		expect(list.items).toHaveLength(4)
		const nested = list.items[1].c[1] as Extract<Block, { t: "list" }>
		expect(nested.items).toHaveLength(2)
		expect(list.items[2].checked).toBe(true)
		expect(list.items[3].checked).toBe(false)
		const ordered = b[1] as Extract<Block, { t: "list" }>
		expect(ordered.ordered).toBe(true)
		expect(ordered.start).toBe(3)
	})

	test("a different bullet starts a new list; blank lines between items don't", () => {
		expect(parse("- a\n* b").map(x => x.t)).toEqual(["list", "list"])
		const loose = parse("- a\n\n- b")
		expect(loose).toHaveLength(1)
		expect((loose[0] as { items: unknown[] }).items).toHaveLength(2)
	})

	test("emphasis markers aren't list markers", () => {
		expect(parse("**bold** start")[0].t).toBe("p")
		expect(parse("*it* start")[0].t).toBe("p")
		expect(parse("* * *")[0].t).toBe("hr")
	})

	test("block quotes nest and take lazy lines", () => {
		const q = parse("> a\n> > b\ncontinued")[0] as Extract<
			Block,
			{ t: "quote" }
		>
		expect(q.t).toBe("quote")
		expect(q.c[1].t).toBe("quote")
	})

	test("tables, with alignment, ragged rows and escaped pipes", () => {
		const t = parse(
			"| A | B |\n|:--|--:|\n| 1 | x \\| y |\n| 2 |"
		)[0] as Extract<Block, { t: "table" }>
		expect(t.t).toBe("table")
		expect(t.align).toEqual(["left", "right"])
		expect(t.head.map(plain)).toEqual(["A", "B"])
		expect(t.rows[0].map(plain)).toEqual(["1", "x | y"])
		expect(t.rows[1].map(plain)).toEqual(["2", ""])
		// not a table without the rule row
		expect(parse("a | b\nc | d")[0].t).toBe("p")
	})
})

describe("inline", () => {
	test("strong, emphasis, strikethrough and combinations", () => {
		expect(inlines("**a** *b* _c_ __d__ ~~e~~")).toEqual([
			{ t: "strong", c: ["a"] },
			" ",
			{ t: "em", c: ["b"] },
			" ",
			{ t: "em", c: ["c"] },
			" ",
			{ t: "strong", c: ["d"] },
			" ",
			{ t: "del", c: ["e"] },
		])
		expect(inlines("***both***")).toEqual([
			{ t: "em", c: [{ t: "strong", c: ["both"] }] },
		])
		expect(inlines("**a *b* c**")).toEqual([
			{ t: "strong", c: ["a ", { t: "em", c: ["b"] }, " c"] },
		])
	})

	test("snake_case and 2 * 3 * 4 stay text", () => {
		expect(inlines("snake_case_word")).toEqual(["snake_case_word"])
		expect(inlines("2 * 3 * 4")).toEqual(["2 * 3 * 4"])
		expect(inlines("a * b")).toEqual(["a * b"])
	})

	test("unclosed markers are text", () => {
		expect(inlines("**open")).toEqual(["**open"])
		expect(inlines("a `tick")).toEqual(["a `tick"])
		expect(inlines("[not a link")).toEqual(["[not a link"])
		expect(inlines("![x")).toEqual(["![x"])
	})

	test("code spans", () => {
		expect(inlines("`a *b*` and ``x ` y``")).toEqual([
			{ t: "code", v: "a *b*" },
			" and ",
			{ t: "code", v: "x ` y" },
		])
	})

	test("escapes and line breaks", () => {
		expect(inlines("\\*not\\* em")).toEqual(["*not* em"])
		expect(inlines("a  \nb")).toEqual(["a", { t: "br" }, "b"])
		expect(inlines("a\\\nb")).toEqual(["a", { t: "br" }, "b"])
		expect(inlines("a\nb")).toEqual(["a b"])
	})

	test("links and images", () => {
		expect(inlines('[**x**](https://e.com/a_b "T")')).toEqual([
			{
				t: "link",
				href: "https://e.com/a_b",
				title: "T",
				c: [{ t: "strong", c: ["x"] }],
			},
		])
		expect(inlines("[a](/news/1/x) [b](#top) [m](mailto:a@b.co)")).toEqual([
			{ t: "link", href: "/news/1/x", title: undefined, c: ["a"] },
			" ",
			{ t: "link", href: "#top", title: undefined, c: ["b"] },
			" ",
			{ t: "link", href: "mailto:a@b.co", title: undefined, c: ["m"] },
		])
		expect(inlines("![alt *x*](https://e.com/i.png)")).toEqual([
			{
				t: "img",
				src: "https://e.com/i.png",
				alt: "alt x",
				title: undefined,
			},
		])
		expect(inlines("[a](/p_(1)_x)")[0]).toMatchObject({ href: "/p_(1)_x" })
	})

	test("links don't nest", () => {
		// the inner one is the link; the outer brackets are text, though the bare
		// address after them is linked on its own
		const out = inlines("[a [b](https://x.co) c](https://y.co)")
		const links = out.filter(n => typeof n === "object" && n.t === "link")
		expect(links.map(n => plain([n]))).toEqual(["b", "https://y.co"])
		expect(plain(out)).toBe("[a b c](https://y.co)")
	})

	test("bare and angle links, without the sentence's punctuation", () => {
		expect(inlines("see https://e.com/a.")).toEqual([
			"see ",
			{ t: "link", href: "https://e.com/a", c: ["https://e.com/a"] },
			".",
		])
		expect(inlines("(https://e.com/a_(b))")[1]).toMatchObject({
			href: "https://e.com/a_(b)",
		})
		expect(inlines("<https://e.com>")[0]).toMatchObject({
			t: "link",
			href: "https://e.com",
		})
		expect(inlines("**https://e.com**")[0]).toMatchObject({ t: "strong" })
		expect(inlines("xhttps://e.com")).toEqual(["xhttps://e.com"])
	})
})

describe("safety", () => {
	test("only web, mail, site and anchor links survive", () => {
		for (const bad of [
			"javascript:alert(1)",
			"JaVaScRiPt:alert(1)",
			"  javascript:alert(1)",
			"data:text/html;base64,AAAA",
			"vbscript:x",
			"//evil.example/x",
			"/\\evil.example",
			"file:///etc/passwd",
			'https://a.co/"onmouseover=x',
			"https://a.co/a b",
			"https://a.co/\u0000x",
			"https://a.co/ x",
		])
			expect(safeUrl(bad), bad).toBeNull()
		for (const good of [
			"https://a.co/x?y=1#z",
			"http://a.co",
			"/a/b?c",
			"#top",
			"mailto:a@b.co",
		])
			expect(safeUrl(good), good).toBe(good)
	})

	test("images are https or site paths only", () => {
		expect(safeUrl("http://a.co/i.png", true)).toBeNull()
		expect(safeUrl("mailto:a@b.co", true)).toBeNull()
		expect(safeUrl("#x", true)).toBeNull()
		expect(safeUrl("https://a.co/i.png", true)).not.toBeNull()
		expect(safeUrl("/assets/icon", true)).not.toBeNull()
	})

	test("an unsafe link keeps its text but loses the link; an unsafe image keeps its alt", () => {
		expect(inlines("[click](javascript:alert(1))")).toEqual(["click"])
		expect(inlines("![pic](data:image/svg+xml;base64,AAAA)")).toEqual([
			"pic",
		])
		expect(JSON.stringify(parse("[x](javascript:alert(1))"))).not.toContain(
			"javascript"
		)
	})

	test("raw HTML is text, never markup", () => {
		const md =
			'<script>alert(1)</script> <img src=x onerror=alert(1)> <a href="javascript:x">y</a>'
		const out = JSON.stringify(parse(md))
		expect(out).not.toContain('"t":"link"')
		expect(out).not.toContain('"t":"img"')
		expect(plain(inlines(md))).toBe(md)
	})

	test("the tree only has the node kinds the renderer handles", () => {
		const kinds = new Set<string>()
		const walk = (n: unknown) => {
			if (Array.isArray(n)) n.forEach(walk)
			else if (n && typeof n === "object") {
				const o = n as Record<string, unknown>
				if (typeof o.t === "string") kinds.add(o.t)
				Object.values(o).forEach(walk)
			}
		}
		walk(
			parse(
				"# h\n\n> q\n\n- a\n\n1. b\n\n```\nc\n```\n\n---\n\n| a |\n|---|\n| b |\n\n**s** *e* ~~d~~ `c` [l](/x) ![i](/y)  \nz"
			)
		)
		expect([...kinds].sort()).toEqual(
			[
				"br",
				"code",
				"del",
				"em",
				"h",
				"hr",
				"img",
				"link",
				"list",
				"p",
				"quote",
				"strong",
				"table",
			].sort()
		)
	})
})

describe("hostile input stays fast", () => {
	const big = 200_000
	const cases: [string, string][] = [
		["stars", "*".repeat(big)],
		["open stars", "*a ".repeat(big / 3)],
		["underscores", "_a".repeat(big / 2)],
		["tildes", "~~a ".repeat(big / 4)],
		["brackets", "[".repeat(big)],
		["images", "![".repeat(big / 2)],
		["link starts", "[a](".repeat(big / 4)],
		["angle starts", "[a](<".repeat(big / 5)],
		["parens", `[a](${"(".repeat(big)}`],
		[
			"ticks of every length",
			Array.from({ length: 600 }, (_, i) => "`".repeat(i + 1)).join("a "),
		],
		["lone ticks", "`a".repeat(big / 2)],
		["less-thans", `${"<".repeat(big)}>`],
		["urls", "http://".repeat(big / 7)],
		["quotes", ">".repeat(big)],
		["quote lines", "> ".repeat(100) + "x\n".repeat(big / 2)],
		["list markers", "- ".repeat(big / 2)],
		["list lines", "- a\n".repeat(big / 4)],
		[
			"nested lists",
			Array.from(
				{ length: 2000 },
				(_, i) => `${"  ".repeat(i % 60)}- a`
			).join("\n"),
		],
		["ordered", "1. ".repeat(big / 3)],
		["pipes", `${"|a".repeat(big / 2)}\n${"|-".repeat(big / 2)}`],
		["table rows", `|a|\n|-|\n${"|x|\n".repeat(big / 4)}`],
		["fences", "```\n".repeat(big / 4)],
		["hashes", "#".repeat(big)],
		["spaces", `${" ".repeat(big)}x`],
		["mixed", "*a [b](c `d ".repeat(big / 12)],
	]
	for (const [name, text] of cases)
		test(name, () => {
			const t0 = performance.now()
			parse(text)
			expect(performance.now() - t0).toBeLessThan(1500)
		})
})

describe("excerpt", () => {
	test("plain text of the first paragraphs, cut at a word", () => {
		const e = excerpt(
			`# T\n\nSome **bold** [link](/x) text.\n\n> quoted\n\n${"word ".repeat(100)}`,
			60
		)
		expect(e.startsWith("Some bold link text. quoted word")).toBe(true)
		expect(e.length).toBeLessThanOrEqual(61)
		expect(e.endsWith("…")).toBe(true)
	})

	test("short posts are kept whole", () => {
		expect(excerpt("Hello *world*")).toBe("Hello world")
		expect(excerpt("")).toBe("")
	})
})
