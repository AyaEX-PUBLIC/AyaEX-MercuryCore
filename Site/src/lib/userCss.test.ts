import { describe, expect, test } from "bun:test"
import sanitiseCss from "./userCss"

const css = (input: string) => sanitiseCss(input).css

describe("kept", () => {
	test("ordinary rules", () => {
		expect(css("body { background: #111; color: rgb(250 250 250 / 0.9) }")).toBe(
			"body { background: #111; color: rgb(250 250 250 / 0.9) }"
		)
		expect(css(".a > .b:not(.c)::before{content:'hi';font:12px/1.5 \"Geist\", sans-serif !important}")).toBe(
			".a > .b:not(.c)::before { content: 'hi'; font: 12px/1.5 \"Geist\", sans-serif !important }"
		)
		expect(css("a[href^=\"/user\"] { --accent: 10px; margin: calc(1rem + 2px) }")).toBe(
			"a[href^=\"/user\"] { --accent: 10px; margin: calc(1rem + 2px) }"
		)
	})

	test("@media, @supports and @keyframes", () => {
		expect(css("@media (max-width: 600px) { .x { display: none } }")).toBe(
			"@media (max-width: 600px) {\n.x { display: none }\n}"
		)
		expect(css("@keyframes spin { from { rotate: 0deg } 50%, to { rotate: 360deg } }")).toBe(
			"@keyframes spin {\nfrom { rotate: 0deg }\n50%, to { rotate: 360deg }\n}"
		)
		expect(css("@supports (display: grid) { .g { display: grid } }")).toContain(".g { display: grid }")
	})
})

describe("dropped", () => {
	test("closing the style element", () => {
		for (const input of [
			"</style><script>alert(1)</script>",
			"body{}</style><img src=x onerror=alert(1)>",
			"a { content: '</style><script>alert(1)</script>' }",
			"a { color: red }</STYLE ><svg onload=alert(1)>",
		]) {
			const out = css(input)
			expect(out).not.toContain("<")
			expect(out.toLowerCase()).not.toContain("script")
		}
	})

	test("anything that loads something", () => {
		const { css: out, removed } = sanitiseCss(
			"@import 'https://evil.example/x.css';\n" +
				"body { background: url(https://evil.example/a.png); color: red }\n" +
				"a { background-image: image-set('x.png' 1x) }\n" +
				"@font-face { font-family: x; src: url(x.woff) }\n" +
				"b { background: URL( 'x' ) }"
		)
		expect(out).toBe("body { color: red }")
		expect(out).not.toMatch(/url|import|font-face|image-set/i)
		expect(removed.length).toBeGreaterThan(0)
	})

	test("escapes that would hide a url()", () => {
		expect(css("a { background: \\75 rl(https://evil.example) }")).not.toMatch(/rl\(/)
		expect(css("a { background: u\\rl(x) }")).toBe("")
	})

	test("old script-running properties and values", () => {
		expect(css("a { behavior: url(x.htc); -moz-binding: url(x); width: expression(alert(1)) }")).toBe("")
	})

	test("broken input", () => {
		expect(css("a { color: red")).toBe("")
		expect(css("a { content: 'unclosed }")).toBe("")
		expect(css("color: red; b { color: blue }")).toBe("b { color: blue }")
		expect(css("@media screen { @media screen { @media screen { @media screen { a { color: red } } } } }")).not.toContain("color")
		expect(css("/* comment */ a { color: red } /* unclosed")).toBe("a { color: red }")
	})
})
