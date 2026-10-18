// Live shoutbox updates as server-sent events, for every channel the user can
// read. EventSource reconnects by itself and sends the last cursor it saw
// (Last-Event-ID), so the stream replays what it missed, or sends "reset" when
// it can't and the client reloads instead.

import { error } from "@sveltejs/kit"
import { cachedChannel, getChannels } from "$lib/server/shoutbox"
import { cursor, type Entry, since, subscribe } from "$lib/server/shoutbox/live"
import { canRead } from "$lib/shoutbox/permissions"

// limits on open streams, so nobody can tie up the server with them
const maxPerUser = 8
const maxTotal = 3000
const open = new Map<string, number>()
let total = 0

// end streams every few minutes, so reconnecting checks the session again
const lifetime = 5 * 60e3
// keeps proxies from closing a quiet stream
const heartbeat = 25e3

export async function GET({ locals, request, url }) {
	const { user } = locals
	if (!user) error(401, "You must be logged in")
	if ((open.get(user.id) || 0) >= maxPerUser || total >= maxTotal)
		error(429, "Too many shoutbox connections")
	await getChannels() // so the cache is ready for the checks below

	const level = user.permissionLevel
	const visible = ({ event }: Entry) => {
		if (event.type === "channels") return true
		const channel = cachedChannel(event.channel)
		return !!channel && canRead(channel, level)
	}
	const after =
		request.headers.get("last-event-id") ||
		url.searchParams.get("after") ||
		""

	const encoder = new TextEncoder()
	let stop = () => {}

	const stream = new ReadableStream({
		start(controller) {
			const close = () => {
				stop()
				try {
					controller.close()
				} catch {}
			}
			const send = (text: string) => {
				// a reader that stopped reading isn't coming back
				if ((controller.desiredSize ?? 0) < -500) return close()
				try {
					controller.enqueue(encoder.encode(text))
				} catch {
					stop()
				}
			}
			const format = (entry: Entry) =>
				visible(entry)
					? `id: ${entry.cursor}\ndata: ${JSON.stringify(entry.event)}\n\n`
					: ""

			// what was missed goes out in one chunk, however much it is
			const missed = after ? since(after) : null
			send(
				`retry: 3000\n\n${
					missed
						? missed.map(format).join("")
						: `id: ${cursor()}\nevent: reset\ndata: {}\n\n`
				}`
			)

			const unsubscribe = subscribe(entry => {
				const text = format(entry)
				if (text) send(text)
			})
			const ping = setInterval(() => send(": ping\n\n"), heartbeat)
			const end = setTimeout(close, lifetime)

			open.set(user.id, (open.get(user.id) || 0) + 1)
			total++
			let stopped = false
			stop = () => {
				if (stopped) return
				stopped = true
				unsubscribe()
				clearInterval(ping)
				clearTimeout(end)
				const count = (open.get(user.id) || 1) - 1
				if (count) open.set(user.id, count)
				else open.delete(user.id)
				total--
			}
			// Bun doesn't cancel the stream when the client goes away, but it
			// does abort the request
			if (request.signal.aborted) close()
			else request.signal.addEventListener("abort", close, { once: true })
		},
		cancel() {
			stop()
		},
	})

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			"X-Accel-Buffering": "no", // nginx would otherwise hold events back
		},
	})
}
