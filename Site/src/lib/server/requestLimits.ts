// Per-route request body limits.
//
// The Site runs two adapter-node instances in production: the public one has
// BODY_SIZE_LIMIT=1M, and a second one on localhost:4445 (UPLOAD_ONLY=1) is
// reachable only through Caddy's upload routes and accepts the larger bodies
// that the place and asset editors need. Both still enforce the route-specific
// limit below, so a misconfigured proxy can't turn into an unbounded read.

import {
	assetUploadLimit,
	defaultBodyLimit,
	imageUploadLimit,
	placeUploadLimit,
} from "$lib/server/body"

const placeSettings = /^\/place\/\d+\/[^/]+\/settings(?:\/|$)/
const placeSettingsFile = /^\/place\/\d+\/[^/]+\/settings\/file$/
const studioPlaceFile = /^\/studio\/api\/places\/\d+\/file$/

/** Routes Caddy sends to the upload instance. */
export function isUploadPath(pathname: string) {
	return (
		placeSettings.test(pathname) ||
		studioPlaceFile.test(pathname) ||
		pathname === "/develop/create" ||
		pathname === "/admin/create" ||
		pathname === "/admin/news"
	)
}

/** Routes that stream to disk themselves, rather than buffering a form. */
export function streamsItself(pathname: string) {
	return placeSettingsFile.test(pathname) || studioPlaceFile.test(pathname)
}

/** Largest body a route may receive, counted in bytes while it streams. */
export function bodyLimitFor(pathname: string) {
	if (placeSettingsFile.test(pathname) || studioPlaceFile.test(pathname))
		return placeUploadLimit
	if (pathname === "/develop/create" || pathname === "/admin/create")
		return assetUploadLimit
	if (pathname === "/admin/news") return imageUploadLimit
	if (placeSettings.test(pathname)) return imageUploadLimit
	return defaultBodyLimit
}

/**
 * Whether this process is the upload half of the deployment. It exists only
 * for the larger upload routes, so it refuses everything else.
 */
export const uploadOnly = process.env.UPLOAD_ONLY === "1"
