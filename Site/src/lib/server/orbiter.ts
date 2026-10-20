import config from "$lib/server/config"
import type { ReturnErr, ReturnValue } from "./economy"

type Gameserver = {
	pid: number
	startTime: number
	/** 0 closed, 1 starting, 2 running */
	status?: number
}

type GameserverId = [number, Gameserver]

export async function listGameservers(
	f: typeof globalThis.fetch
): ReturnValue<GameserverId[]> {
	try {
		const res = await f(config.Orbiter.PrivateURL)
		if (!res.ok) return { ok: false }
		return { ok: true, value: await res.json() }
	} catch {
		return { ok: false }
	}
}

/** Is this place's gameserver starting or running? */
export async function gameserverActive(
	f: typeof globalThis.fetch,
	placeId: number
) {
	const res = await listGameservers(f)
	return (
		res.ok &&
		res.value.some(
			([id, server]) =>
				id === placeId && (server.status === 1 || server.status === 2)
		)
	)
}

async function fetchGameserver(
	f: typeof globalThis.fetch,
	path: string | number,
	method: string
): Promise<ReturnErr> {
	try {
		const res = await f(`${config.Orbiter.PrivateURL}/${path}`, { method })
		if (!res.ok) return { ok: false, msg: await res.text() }
	} catch (err) {
		const e = err as Error
		return { ok: false, msg: e.message }
	}
	return { ok: true }
}

export const startGameserver = async (
	f: typeof globalThis.fetch,
	placeId: number,
	clientVersion: number
) =>
	fetchGameserver(
		f,
		`${placeId}?engine=${clientVersion >= 2016 ? "rcc" : "studio"}`,
		"put"
	)

export const closeGameserver = async (
	f: typeof globalThis.fetch,
	placeId: number
) => fetchGameserver(f, placeId, "delete")
