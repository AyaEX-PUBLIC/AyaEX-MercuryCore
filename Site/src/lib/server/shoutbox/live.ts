// Live shoutbox updates. Every change is numbered and kept for a while, so a
// stream that reconnects (routes/api/shoutbox/stream) can catch up on what it
// missed. The Site runs as a single process, so this lives in memory; after a
// restart the boot id changes and clients reload instead.

import type { Shout } from "$lib/shoutbox/types"

export type ShoutEvent =
	| { type: "new" | "edit"; channel: string; shout: Shout }
	| { type: "delete"; channel: string; id: string }
	| { type: "channels" } // added, changed or removed; clients reload the list

export type Entry = { cursor: string; event: ShoutEvent }

const bootId = crypto.randomUUID().slice(0, 8)
const kept = 500
let seq = 0
const recent: { seq: number; entry: Entry }[] = []
const listeners = new Set<(entry: Entry) => void>()

/** The cursor of the latest change, for clients that load messages now */
export const cursor = () => `${bootId}.${seq}`

export function publish(event: ShoutEvent) {
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
