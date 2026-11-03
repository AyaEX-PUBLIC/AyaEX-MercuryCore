// Shoutbox message limits, shared by the composer and the server
// (lib/server/shoutbox/clean.ts), which enforces them.

/** Longest message, in characters as people see them (graphemes) */
export const maxLength = 500
/** Most lines a message can have */
export const maxLines = 6
/** Most emoji in one message */
export const maxEmoji = 20
/** Most different emoji people can react to one message with */
export const maxReactions = 5
/** How long after sending a message its author can still edit it */
export const editWindow = 15 * 60e3

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Splits text into the characters people see, e.g. one emoji with a skin tone */
export const graphemes = (text: string) =>
	Array.from(segmenter.segment(text), s => s.segment)

export const isEmoji = (grapheme: string) =>
	/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(grapheme)
