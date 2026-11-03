// Live shoutbox updates. Every change is numbered and kept for a while, so a
// stream that reconnects (routes/api/shoutbox/stream) can catch up on what it
// missed. The Site runs as a single process, so this lives in memory; after a
// restart the boot id changes and clients reload instead.

import type { Reaction, Shout } from "$lib/shoutbox/types"

export type ShoutEvent =
	| { type: "new" | "edit"; channel: string; shout: Shout }
	| { type: "delete"; channel: string; id: string }
	// everyone's reactions to a message, after one was added or removed
	| { type: "react"; channel: string; id: string; reactions: Reaction[] }
	| { type: "channels" } // added, changed or removed; clients reload the list

export type Entry = { cursor: string; event: ShoutEvent }

const bootId = crypto.randomUUID().slice(0, 8)
const kept = 500
let seq = 0
const recent: { seq: number; entry: Entry }[] = []
const listeners = new Set<(entry: Entry) => void>()

/** The cursor of the latest change, for clients that load messages now */
export const cursor = () => `${bootId}.${seq}`

/** A kept change, as it is after a later deletion or edit (of its message, or of the one it replies to) */
function rewrite(event: ShoutEvent, later: ShoutEvent): ShoutEvent {
	if (later.type !== "delete" && later.type !== "edit") return event
	const id = later.type === "delete" ? later.id : later.shout.id
	if (event.type === "react" && event.id === id && later.type === "delete")
		return { type: "delete", channel: event.channel, id }
	if (event.type !== "new" && event.type !== "edit") return event

	if (event.shout.id === id)
		return later.type === "delete"
			? { type: "delete", channel: event.channel, id }
			: // (with its reactions as they were then: later changes follow)
				{
					...event,
					shout: { ...later.shout, reactions: event.shout.reactions },
				}

	if (event.shout.replyTo?.id !== id) return event
	return {
		...event,
		shout: {
			...event.shout,
			replyTo:
				later.type === "delete"
					? { id, deleted: true }
					: {
							id,
							deleted: false,
							author: later.shout.author.username,
							body: later.shout.body,
						},
		},
	}
}

export function publish(event: ShoutEvent) {
	// a stream catching up must never see a deleted message, or a message as it
	// was before an edit (both are only for moderators), not even quoted in a
	// reply, so rewrite the kept changes: earlier ones for a deleted message
	// become the deletion, and earlier ones for an edited message carry the
	// new text
	for (const r of recent) {
		const rewritten = rewrite(r.entry.event, event)
		if (rewritten !== r.entry.event)
			r.entry = { cursor: r.entry.cursor, event: rewritten }
	}

	seq++
	const entry = { cursor: cursor(), event }
	recent.push({ seq, entry })
	if (recent.length > kept) recent.shift()
	for (const listener of listeners)
		try {
			listener(entry)
		} catch (e) {
			console.error("Shoutbox listener failed:", e)
		}
}

/**
 * Changes made after a cursor.
 * @returns The changes, or null if they aren't all kept any more (or the Site restarted since).
 */
export function since(after: string): Entry[] | null {
	const [boot, n] = after.split(".")
	const from = Number(n)
	if (boot !== bootId || !Number.isSafeInteger(from) || from > seq)
		return null
	if (from === seq) return []
	const first = recent[0]?.seq ?? seq + 1
	if (from + 1 < first) return null
	return recent.filter(r => r.seq > from).map(r => r.entry)
}

export function subscribe(listener: (entry: Entry) => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}
