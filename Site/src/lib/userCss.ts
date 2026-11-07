// Custom CSS (Settings > Styling) is parsed and rebuilt from what's allowed,
// never passed on as written. It's served as a stylesheet of its own
// (routes/api/usercss), and nothing it can contain loads anything from
// elsewhere: no url(), @import or @font-face. Allowed:
// - style rules: selectors made of the usual selector characters
// - @media and @supports around style rules, and @keyframes
// - declarations whose property is a plain name or a --custom-property, and
//   whose value has letters, numbers, strings, and # . , % + - * / ( ) !
// Anything else (backslash escapes, <, unknown at-rules, unbalanced quotes)
// drops the declaration or rule it's in.

export const maxCssLength = 10000

/** Where the signed-in user's sanitised CSS is served (routes/api/usercss) */
export const userCssPath = "/api/usercss"

/** What a sanitised stylesheet kept, and what it dropped (short descriptions) */
export type CleanCss = { css: string; removed: string[] }

const maxDepth = 3

const propertyName = /^(--[a-zA-Z0-9_-]{1,64}|-?[a-zA-Z][a-zA-Z0-9-]{0,63})$/
const blockedProperties = new Set(["behavior", "-moz-binding", "binding"])
// what a value may be made of (strings are checked separately)
const valueChars = /^[a-zA-Z0-9\s#.,%+\-*/()!'"_]*$/
// anything that fetches something, or ran script in old browsers
const blockedFunctions =
	/\b(url|image|image-set|-webkit-image-set|cross-fade|element|expression|src)\s*\(/i
const selectorChars = /^[a-zA-Z0-9\s_\-#.:*>+~,()[\]="'^$|%/]+$/
const conditionChars = /^[a-zA-Z0-9\s(),:.\-%]*$/
const keyframeName = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/
const keyframeSelector =
	/^(from|to|\d{1,3}(\.\d+)?%)(\s*,\s*(from|to|\d{1,3}(\.\d+)?%))*$/i

/** Quotes are balanced, and no string spans lines */
function stringsClosed(text: string) {
	let quote = ""
	for (const c of text) {
		if (quote) {
			if (c === quote) quote = ""
			else if (c === "\n") return false
		} else if (c === '"' || c === "'") quote = c
	}
	return !quote
}

/**
 * Splits CSS into top-level statements: `prelude { body }` blocks, and
 * `prelude;` statements (body null), skipping over strings and brackets.
 */
function statements(text: string) {
	const out: { prelude: string; body: string | null }[] = []
	let i = 0
	while (i < text.length) {
		let quote = ""
		let parens = 0
		let start = i
		for (; i < text.length; i++) {
			const c = text[i]
			if (quote) {
				if (c === quote) quote = ""
			} else if (c === '"' || c === "'") quote = c
			else if (c === "(") parens++
			else if (c === ")") parens = Math.max(0, parens - 1)
			else if (!parens && (c === "{" || c === ";" || c === "}")) break
		}
		const prelude = text.slice(start, i).trim()
		if (i >= text.length) {
			if (prelude) out.push({ prelude, body: null })
			break
		}
		if (text[i] !== "{") {
			// a stray ; or }
			if (prelude) out.push({ prelude, body: null })
			i++
			continue
		}
		// find the matching }
		let depth = 1
		quote = ""
		start = ++i
		for (; i < text.length && depth; i++) {
			const c = text[i]
			if (quote) {
				if (c === quote) quote = ""
			} else if (c === '"' || c === "'") quote = c
			else if (c === "{") depth++
			else if (c === "}") depth--
		}
		// an unclosed block is dropped
		out.push({ prelude, body: depth ? null : text.slice(start, i - 1) })
	}
	return out
}

/** Splits declarations on ; outside strings and brackets */
function declarationsOf(body: string) {
	const out: string[] = []
	let quote = ""
	let parens = 0
	let start = 0
	for (let i = 0; i <= body.length; i++) {
		const c = body[i]
		if (i < body.length && quote) {
			if (c === quote) quote = ""
		} else if (c === '"' || c === "'") quote = c
		else if (c === "(") parens++
		else if (c === ")") parens = Math.max(0, parens - 1)
		else if (i === body.length || (c === ";" && !parens)) {
			const d = body.slice(start, i).trim()
			if (d) out.push(d)
			start = i + 1
		}
	}
	return out
}

function cleanDeclarations(body: string, removed: string[]) {
	const kept: string[] = []
	for (const declaration of declarationsOf(body)) {
		const colon = declaration.indexOf(":")
		const name = colon > 0 ? declaration.slice(0, colon).trim() : ""
		const value = colon > 0 ? declaration.slice(colon + 1).trim() : ""
		const property = name.startsWith("--") ? name : name.toLowerCase()

		if (!propertyName.test(property) || blockedProperties.has(property))
			removed.push(`the property "${name.slice(0, 40)}"`)
		else if (!value || value.length > 1000)
			removed.push(`the value of ${property}`)
		else if (blockedFunctions.test(value))
			removed.push(`${property}: url() and other images or imports aren't allowed`)
		else if (!valueChars.test(value) || !stringsClosed(value))
			removed.push(`the value of ${property}`)
		else kept.push(`${property}: ${value.replace(/\s+/g, " ")}`)
	}
	return kept
}

function cleanBlock(text: string, depth: number, removed: string[]): string[] {
	const rules: string[] = []
	for (const { prelude, body } of statements(text)) {
		if (body === null) {
			removed.push(
				prelude.startsWith("@")
					? `"${prelude.split(/\s/)[0].slice(0, 30)}" (only @media, @supports and @keyframes are allowed)`
					: `"${prelude.slice(0, 40)}" (not a complete rule)`
			)
			continue
		}

		if (prelude.startsWith("@")) {
			const name = (/^@([a-zA-Z-]+)/.exec(prelude)?.[1] || "").toLowerCase()
			const condition = prelude.slice(name.length + 1).trim()

			if (name === "media" || name === "supports") {
				if (depth >= maxDepth || !conditionChars.test(condition)) {
					removed.push(`an @${name} rule`)
					continue
				}
				const inner = cleanBlock(body, depth + 1, removed)
				if (inner.length) rules.push(`@${name} ${condition} {\n${inner.join("\n")}\n}`)
			} else if (name === "keyframes" || name === "-webkit-keyframes") {
				if (!keyframeName.test(condition)) {
					removed.push("an @keyframes rule")
					continue
				}
				const frames: string[] = []
				for (const frame of statements(body)) {
					const declarations =
						frame.body !== null && keyframeSelector.test(frame.prelude)
							? cleanDeclarations(frame.body, removed)
							: null
					if (declarations === null) removed.push(`a keyframe in @keyframes ${condition}`)
					else if (declarations.length)
						frames.push(`${frame.prelude} { ${declarations.join("; ")} }`)
				}
				if (frames.length) rules.push(`@${name} ${condition} {\n${frames.join("\n")}\n}`)
			} else removed.push(`"@${name}" (only @media, @supports and @keyframes are allowed)`)
			continue
		}

		const selector = prelude.replace(/\s+/g, " ")
		if (
			selector.length > 500 ||
			!selectorChars.test(selector) ||
			!stringsClosed(selector)
		) {
			removed.push(`the selector "${selector.slice(0, 40)}"`)
			continue
		}
		const declarations = cleanDeclarations(body, removed)
		if (declarations.length) rules.push(`${selector} { ${declarations.join("; ")} }`)
	}
	return rules
}

/**
 * Rebuilds custom CSS from the parts of it that are allowed.
 * @returns The CSS to use, and descriptions of what was dropped.
 * @example
 * const { css, removed } = sanitiseCss(input)
 */
export default function sanitiseCss(input: string): CleanCss {
	const removed: string[] = []
	const text = input
		.slice(0, maxCssLength)
		.replace(/\r\n?/g, "\n")
		.replace(/\/\*[\s\S]*?(\*\/|$)/g, " ") // comments

	// Backslash escapes (which could hide what a value really is) and < fail
	// every check below, so the parts they're in are dropped. What's kept has
	// neither, so a browser reads it exactly as it was checked.
	const css = cleanBlock(text, 0, removed).join("\n")
	// (nothing above lets one through, but this is the last line of defence)
	if (css.includes("<")) return { css: "", removed: ["everything"] }
	return { css, removed: [...new Set(removed)] }
}
