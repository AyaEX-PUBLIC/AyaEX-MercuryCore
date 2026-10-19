// Signaling for Remote StreamingFrames in the Aya Player. A Remote
// StreamingFrame shows the screen that its controlling player shares from
// their browser, sent peer to peer over WebRTC. This relays the offers,
// answers and ICE candidates between the players in a game, with the protocol
// of Aya's own API (aya-dev apiserver/main.py, /streaming/ws) that the
// Player's Aya.App.StreamingFrame.js speaks. The Player gets the address, and
// the engine UserId it plays as, from routes/streaming/token.
//
// Server StreamingFrames (a browser run on the gameserver) stay off: the
// gameservers are never started with --allow-server-streamingframes.
//
// adapter-node can't take WebSockets, so the relay is a Bun server of its own
// in the Site process, on STREAMING_PORT on 127.0.0.1 only (Caddyfile.aya
// proxies /streaming/ws to it). A socket belongs to a player: it's opened
// from the Site's origin with their session cookie, for a place they're
// playing, and that's checked again every minute. Relayed messages carry
// their sender's peer id and UserId, set here, so nobody can speak for another
// player, and the Player only shows a frame's stream from its ControlingUserID.

import { randomBytes } from "node:crypto"
import type { Server, ServerWebSocket } from "bun"
import { env } from "$env/dynamic/private"
import { cookieName, validateSessionToken } from "$lib/server/auth"
import { engineUserId } from "$lib/server/engineUser"
import { siteOrigin } from "$lib/server/origin"
import { db, Record } from "$lib/server/surreal"
import allowedQuery from "./streaming.surql"

type Peer = {
	id: string
	place: number
	/** The engine UserId, which the Player compares with ControlingUserID */
	userId: number
	account: string
	session: string
	windowStart: number
	messages: number
	bytes: number
}
type Socket = ServerWebSocket<Peer>
type Message = { [key: string]: unknown }

const maxPeers = 100 // in one place
const maxSocketsPerAccount = 4 // the same player in a few tabs
const maxMessage = 128 * 1024
const maxSdp = 112 * 1024
const maxCandidate = 16 * 1024
// A player who starts streaming sends an offer and a few ICE candidates to
// everyone else in the game at once
const rateWindow = 10_000
const maxMessagesPerWindow = 2000
const maxBytesPerWindow = 4 * 1024 * 1024
const recheckInterval = 60_000

const rooms = new Map<number, Map<string, Socket>>()
let relay: Server<Peer> | undefined

/** Whether the relay is listening, so the Player can be told to use it */
export const relayRunning = () => !!relay

/**
 * The WebRTC settings for the Player. STREAMING_ICE_SERVERS replaces the
 * public STUN server with a JSON array of RTCIceServer, such as a TURN server.
 * With STREAMING_ICE_POLICY=relay as well, streams only go through it, so
 * players don't learn each other's IP addresses.
 */
export function rtcSettings() {
	let iceServers: unknown[] = [{ urls: ["stun:stun.l.google.com:19302"] }]
	if (env.STREAMING_ICE_SERVERS)
		try {
			const servers = JSON.parse(env.STREAMING_ICE_SERVERS)
			if (
				!Array.isArray(servers) ||
				!servers.every(
					s => typeof s?.urls === "string" || Array.isArray(s?.urls)
				)
			)
				throw new Error("expected an array of RTCIceServer")
			iceServers = servers
		} catch (e) {
			console.error("STREAMING_ICE_SERVERS is invalid:", e)
		}
	return env.STREAMING_ICE_POLICY === "relay"
		? { iceServers, iceTransportPolicy: "relay" }
		: { iceServers }
}

/** Whether a player may use StreamingFrames in a place: they're playing it */
export async function streamingAllowed(account: string, place: number) {
	const [, , allowed] = await db.query<boolean[]>(allowedQuery, {
		user: Record("user", account),
		place: Record("place", place),
	})
	return allowed === true
}

/** The account signed in with a session, if it may be in a place's room */
async function player(session: string, place: number) {
	const { user } = await validateSessionToken(session)
	if (user?.hasPhrase && (await streamingAllowed(user.id, place))) return user
}

function sessionCookie(request: Request) {
	for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
		const [name, ...value] = pair.split("=")
		if (name.trim() !== cookieName) continue
		try {
			return decodeURIComponent(value.join("=").trim())
		} catch {
			return
		}
	}
}

async function upgrade(request: Request, server: Server<Peer>) {
	const url = new URL(request.url)
	const placeId = url.searchParams.get("placeId") ?? ""
	if (url.pathname !== "/streaming/ws" || !/^\d{1,15}$/.test(placeId))
		return new Response("Not found", { status: 404 })
	// a page on another site could open it with the player's cookies otherwise
	if (request.headers.get("origin") !== siteOrigin())
		return new Response("Forbidden", { status: 403 })

	const place = +placeId
	const session = sessionCookie(request)
	const user = session && (await player(session, place))
	if (!session || !user) return new Response("Forbidden", { status: 403 })

	const room = [...(rooms.get(place)?.values() ?? [])]
	if (
		room.length >= maxPeers ||
		room.filter(ws => ws.data.account === user.id).length >=
			maxSocketsPerAccount
	)
		return new Response("Too many connections", { status: 429 })

	const data: Peer = {
		id: randomBytes(12).toString("base64url"),
		place,
		userId: engineUserId(user.username),
		account: user.id,
		session,
		windowStart: Date.now(),
		messages: 0,
		bytes: 0,
	}
	if (server.upgrade(request, { data })) return
	return new Response("Expected a WebSocket", { status: 426 })
}

function broadcast(room: Map<string, Socket>, message: Message, except = "") {
	const text = JSON.stringify(message)
	for (const [id, ws] of room) if (id !== except) ws.send(text)
}

/**
 * A message from a player, checked and cut down to what the Player reads,
 * like Aya's API does, or nothing if it's invalid
 */
function relayed(
	raw: string
): { target: string; message: Message } | undefined {
	let message: Message
	try {
		message = JSON.parse(raw)
	} catch {
		return
	}
	if (!message || typeof message !== "object" || Array.isArray(message))
		return
	const { type, target, guiId } = message
	if (typeof target !== "string" || target.length < 1 || target.length > 64)
		return
	if (
		typeof guiId !== "string" ||
		guiId.length < 1 ||
		guiId.length > 128 ||
		/\p{Cc}/u.test(guiId)
	)
		return

	switch (type) {
		case "offer":
		case "answer": {
			const sdp = message.sdp as Message | null
			if (
				sdp?.type !== type ||
				typeof sdp.sdp !== "string" ||
				Buffer.byteLength(sdp.sdp) > maxSdp
			)
				return
			return {
				target,
				message: { type, guiId, sdp: { type, sdp: sdp.sdp } },
			}
		}
		case "ice": {
			const candidate = message.candidate as Message | null
			if (
				typeof candidate?.candidate !== "string" ||
				candidate.candidate.length > maxCandidate
			)
				return
			const { sdpMid, sdpMLineIndex, usernameFragment } = candidate
			return {
				target,
				message: {
					type,
					guiId,
					candidate: {
						candidate: candidate.candidate,
						sdpMid: typeof sdpMid === "string" ? sdpMid : null,
						sdpMLineIndex: Number.isInteger(sdpMLineIndex)
							? sdpMLineIndex
							: null,
						usernameFragment:
							typeof usernameFragment === "string"
								? usernameFragment
								: null,
					},
				},
			}
		}
		case "state":
			if (typeof message.paused !== "boolean") return
			return { target, message: { type, guiId, paused: message.paused } }
		case "stop":
			return { target, message: { type, guiId } }
	}
}

function open(ws: Socket) {
	const peer = ws.data
	const room = rooms.get(peer.place) ?? new Map<string, Socket>()
	rooms.set(peer.place, room)
	const peers = [...room.values()].map(other => ({
		peerId: other.data.id,
		userId: other.data.userId,
	}))
	room.set(peer.id, ws)
	ws.send(JSON.stringify({ type: "welcome", peerId: peer.id, peers }))
	broadcast(
		room,
		{ type: "peer-joined", peerId: peer.id, userId: peer.userId },
		peer.id
	)
}

function message(ws: Socket, raw: string | Buffer) {
	const peer = ws.data
	const now = Date.now()
	if (now - peer.windowStart > rateWindow) {
		peer.windowStart = now
		peer.messages = 0
		peer.bytes = 0
	}
	peer.messages++
	peer.bytes += typeof raw === "string" ? Buffer.byteLength(raw) : raw.length
	if (peer.messages > maxMessagesPerWindow || peer.bytes > maxBytesPerWindow)
		return ws.close(1008, "Too many signaling messages")

	const checked = typeof raw === "string" ? relayed(raw) : undefined
	if (!checked) return ws.close(1008, "Invalid signaling message")
	const target = rooms.get(peer.place)?.get(checked.target)
	if (!target || target === ws) return
	target.send(
		JSON.stringify({
			...checked.message,
			fromPeer: peer.id,
			fromUser: peer.userId,
		})
	)
}

function close(ws: Socket) {
	const peer = ws.data
	const room = rooms.get(peer.place)
	if (room?.get(peer.id) !== ws) return
	room.delete(peer.id)
	if (!room.size) rooms.delete(peer.place)
	else
		broadcast(room, {
			type: "peer-left",
			peerId: peer.id,
			userId: peer.userId,
		})
}

/** Closes the sockets of players who left the game, signed out or were moderated */
function recheck() {
	const checks = new Map<string, Promise<boolean>>()
	for (const room of rooms.values())
		for (const ws of room.values()) {
			const { session, place } = ws.data
			const key = `${place}/${session}`
			let check = checks.get(key)
			if (!check) {
				// if the database can't be reached, they stay
				check = player(session, place).then(
					user => !!user,
					() => true
				)
				checks.set(key, check)
			}
			check.then(allowed => {
				if (!allowed) ws.close(1008, "Not in this game")
			})
		}
}

/** Starts the relay if STREAMING_PORT is set (hooks.server.ts) */
export function startStreamingRelay() {
	const port = Number(env.STREAMING_PORT)
	if (relay || !port) return
	try {
		relay = Bun.serve<Peer>({
			hostname: "127.0.0.1",
			port,
			fetch: upgrade,
			websocket: {
				maxPayloadLength: maxMessage,
				backpressureLimit: 2 * 1024 * 1024,
				closeOnBackpressureLimit: true,
				open,
				message,
				close,
			},
		})
	} catch (e) {
		console.error(`StreamingFrame relay can't listen on port ${port}:`, e)
		return
	}
	const timer = setInterval(recheck, recheckInterval)
	// adapter-node has stopped taking requests; let the process exit
	process.on("sveltekit:shutdown", () => {
		clearInterval(timer)
		relay?.stop(true)
	})
	console.log(`StreamingFrame relay listening on 127.0.0.1:${port}`)
}
