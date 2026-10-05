/**
 * Parameters of a request from the Aya engine: the query string plus a
 * form-encoded body (whatever its content type, see Caddyfile.aya).
 */
export async function engineParams(request: Request, url: URL) {
	const params = new URLSearchParams(url.searchParams)
	if (request.method !== "GET" && request.method !== "HEAD") {
		const body = await request.text()
		for (const [key, value] of new URLSearchParams(body)) params.set(key, value)
	}
	// the engine isn't consistent about casing (UserID, userId...)
	const get = (...names: string[]) => {
		for (const name of names) {
			const value = params.get(name) ?? params.get(name.toLowerCase())
			if (value !== null) return value
		}
		return undefined
	}
	const int = (...names: string[]) => {
		const value = Number(get(...names))
		return Number.isSafeInteger(value) ? value : undefined
	}
	return { get, int }
}

export const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	})

export const text = (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
	})
