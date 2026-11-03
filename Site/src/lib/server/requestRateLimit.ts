// Small in-process token buckets for unauthenticated routes.
//
// Caddy rate-limits these paths at the edge as well (Caddyfile.aya), but
// the application must not depend on the proxy being configured: this is the
// limit that protects the Site when it is reached directly or through another
// proxy. Keys are client addresses, with a site-wide bucket alongside them so
// a spoofed forwarding header can't multiply the budget without bound.

import { error } from "@sveltejs/kit"
import type { RequestEvent } from "@sveltejs/kit"

type Bucket = { tokens: number; at: number }

const buckets = new Map<string, Bucket>()
const siteBuckets = new Map<string, Bucket>()

const refill = (
	bucket: Bucket,
	burst: number,
	perSecond: number,
	now: number
) => {
	bucket.tokens = Math.min(
		burst,
		bucket.tokens + ((now - bucket.at) / 1000) * perSecond
	)
	bucket.at = now
}

function take(
	map: Map<string, Bucket>,
	key: string,
	burst: number,
	perSecond: number,
	now: number
) {
	const bucket = map.get(key) ?? { tokens: burst, at: now }
	refill(bucket, burst, perSecond, now)
	if (bucket.tokens < 1) return false
	bucket.tokens--
	map.set(key, bucket)
	return true
}

// Forget buckets that have refilled, so a stream of one-off addresses can't
// grow the maps forever.
function sweep(map: Map<string, Bucket>, now: number, perSecond: number) {
	if (map.size < 10_000) return
	for (const [key, bucket] of map) {
		if (bucket.at + (1 / perSecond) * 1000 < now) map.delete(key)
	}
}

/** A client address for rate limiting only. Caddy overwrites XFF in front of
 * the Site, so a browser can't choose its bucket there; a direct request can,
 * but the site-wide bucket still applies. */
export function clientAddress(event: RequestEvent) {
	const forwarded = event.request.headers
		.get("x-forwarded-for")
		?.split(",")[0]
		?.trim()
	if (forwarded) return forwarded
	try {
		return event.getClientAddress()
	} catch {
		return "unknown"
	}
}

export function rateLimit(
	event: RequestEvent,
	category: string,
	{
		burst,
		perSecond,
		siteBurst,
		sitePerSecond = perSecond,
	}: {
		burst: number
		perSecond: number
		siteBurst: number
		sitePerSecond?: number
	},
	key = clientAddress(event)
) {
	const now = Date.now()
	const perClient = take(
		buckets,
		`${category}\u0000${key}`,
		burst,
		perSecond,
		now
	)
	const perSite = take(
		siteBuckets,
		category,
		siteBurst,
		sitePerSecond,
		now
	)

	if (perClient && perSite) return

	sweep(buckets, now, perSecond)
	error(429, "Too many requests, try again shortly")
}
