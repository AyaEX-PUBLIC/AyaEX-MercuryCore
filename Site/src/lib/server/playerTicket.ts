import { createHmac } from "node:crypto"
import { error } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"

// Gameservers run with --insecure, so the engine's own client checks are off,
// but every joining player must still present a ticket signed with the
// gameserver's player ticket key (NetworkServer:SetPlayerTicketKey in
// host.lua). The engine checks it before the Player joins Players, so nobody
// can join as another user. The key is derived from GAMESERVER_KEY and the
// place's server ticket: only the Site and that place's gameserver know it, and
// rotating either changes it.

const hmac = (key: string, message: string) =>
	createHmac("sha256", key).update(message).digest("hex")

export function playerTicketKey(placeId: number, serverTicket: string) {
	if (!env.GAMESERVER_KEY) error(500, "GAMESERVER_KEY is not set")
	return hmac(env.GAMESERVER_KEY, `player-ticket\n${placeId}\n${serverTicket}`)
}

// "timestamp;fullSignature;userSignature", the format Aya.Server checks (see
// Server::setPlayerTicketKey in aya-dev). Each ticket works once, within five
// minutes.
export function playerTicket(
	key: string,
	player: { userId: number; name: string; characterAppearance: string }
) {
	const timestamp = Math.floor(Date.now() / 1000).toString()
	const full = hmac(
		key,
		`full\n${player.userId}\n${player.name}\n${player.characterAppearance}\n${timestamp}`
	)
	const user = hmac(key, `pre\n${player.userId}\n${timestamp}`)
	return `${timestamp};${full};${user}`
}
