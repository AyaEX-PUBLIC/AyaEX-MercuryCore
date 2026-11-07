import { describe, expect, test } from "bun:test"
import discordText from "./discordText"

describe("escaped", () => {
	test("plain text is kept", () => {
		expect(discordText("Hello there 123")).toBe("Hello there 123")
		expect(discordText("Ça va? 😀")).toBe("Ça va\\? 😀")
	})
	test("markdown", () => {
		expect(discordText("**bold** _it_ ~~s~~ `code` ||spoiler||")).toBe(
			"\\*\\*bold\\*\\* \\_it\\_ \\~\\~s\\~\\~ \\`code\\` \\|\\|spoiler\\|\\|"
		)
		expect(discordText("# Heading\n> quote\n- list")).toBe(
			"\\# Heading\n\\> quote\n\\- list"
		)
	})
	test("links and mentions", () => {
		expect(discordText("[free robux](https://evil.example)")).toBe(
			"\\[free robux\\]\\(https\\:\\/\\/evil\\.example\\)"
		)
		expect(discordText("@everyone <@123> <t:1:R>")).toBe(
			"\\@everyone \\<\\@123\\> \\<t\\:1\\:R\\>"
		)
	})
	test("backslashes", () => {
		expect(discordText("\\*")).toBe("\\\\\\*")
	})
})

describe("length", () => {
	test("never empty", () => {
		expect(discordText("")).toBe("-")
		expect(discordText("   \n ")).toBe("-")
	})
	test("cut to fit, escapes included", () => {
		expect(discordText("a".repeat(2000))).toBe(`${"a".repeat(1023)}…`)
		expect(discordText("abcdef", 4)).toBe("abc…")
		expect(discordText("abc", 3)).toBe("abc")
		expect(discordText("a".repeat(1024))).toBe("a".repeat(1024))
		const cut = discordText("*".repeat(600))
		expect(cut.length).toBeLessThanOrEqual(1024)
		expect(cut.endsWith("\\*…")).toBe(true) // no escape cut in half
	})
})
