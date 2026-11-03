// Bounded request bodies and uploads.
//
// adapter-node's BODY_SIZE_LIMIT is a backstop for the whole process, but it
// can't be changed per route (place uploads are much larger than form posts).
// These helpers count bytes while they stream, so a missing or false
// Content-Length can't make a route buffer an endless body. The (Caddy)
// reverse proxy in front of the Site also limits the default request size and
// sends large uploads to the dedicated upload instance.

import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, unlink } from "node:fs/promises"
import { error } from "@sveltejs/kit"

/** One megabyte in the decimal units used by the size limits. */
export const MB = 1_000_000

/** Bodies every route accepts unless it says otherwise. */
export const defaultBodyLimit = 1 * MB
/** Multipart overhead around a place file's 100MB payload. */
export const placeUploadLimit = 101 * MB
/** Multipart overhead around a developer asset's 20MB payload. */
export const assetUploadLimit = 21 * MB
/** Multipart overhead around a 5MB image (news cover, place thumbnail). */
export const imageUploadLimit = 7 * MB

const tooLarge = (limit: number) =>
	error(413, `Request body is larger than ${limit / MB}MB`)

/** The declared body length, if the request gave a usable one. */
function declaredLength(request: { headers: Headers }) {
	const header = request.headers.get("content-length")
	if (header === null) return undefined
	const length = Number(header)
	return Number.isSafeInteger(length) && length >= 0 ? length : undefined
}

/**
 * Rejects a body from its Content-Length alone. This is only an early check:
 * callers must still count the stream, because a client can omit or lie about
 * this header.
 */
export function rejectDeclaredBodyOver(
	request: { headers: Headers },
	limit: number
) {
	const length = declaredLength(request)
	if (length !== undefined && length > limit) tooLarge(limit)
}

/** Reads a request body into memory, stopping as soon as it passes `limit`. */
export async function readBody(request: Request, limit: number) {
	rejectDeclaredBodyOver(request, limit)
	if (!request.body) return new Uint8Array()

	const reader = request.body.getReader()
	const chunks: Uint8Array[] = []
	let size = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			size += value.byteLength
			if (size > limit) {
				reader.cancel("request body too large").catch(() => {})
				tooLarge(limit)
			}
			chunks.push(value)
		}
	} finally {
		reader.releaseLock()
	}

	const body = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		body.set(chunk, offset)
		offset += chunk.byteLength
	}
	return body
}

/** Reads a bounded UTF-8 request body. */
export async function readText(request: Request, limit: number) {
	return new TextDecoder().decode(await readBody(request, limit))
}

/** Parses a bounded JSON request body. */
export async function readJson<T = unknown>(
	request: Request,
	limit: number
): Promise<T> {
	return JSON.parse(await readText(request, limit)) as T
}

/**
 * Parses bounded form data. FormData itself buffers the parts, so it's only
 * used for small forms and images; place files stream to disk instead.
 */
export async function readFormData(request: Request, limit: number) {
	const body = await readBody(request, limit)
	// Bun 1.4 can reject a multipart body parsed in the same tick as the
	// stream read ("incorrect MIME type/boundary"); a microtask lets the
	// request's stream settle before the parser runs.
	await Promise.resolve()
	return new Response(body, {
		headers: {
			"content-type":
				request.headers.get("content-type") ??
				"application/x-www-form-urlencoded",
		},
	}).formData()
}

/**
 * Streams a body into a temporary file, flushing every chunk so that memory
 * use stays bounded. The caller owns the returned file and must move or delete
 * it. A client that stops sending leaves no partial file behind.
 */
export async function streamBodyToTempFile(
	body: ReadableStream<Uint8Array> | null,
	limit: number,
	dir: string,
	name = "upload"
) {
	await mkdir(dir, { recursive: true })

	const path = `${dir}/.${name}-${crypto.randomUUID()}.part`
	const writer = Bun.file(path).writer({ highWaterMark: 1 * MB })
	let size = 0
	let finished = false

	try {
		if (body) {
			const reader = body.getReader()
			try {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break
					size += value.byteLength
					if (size > limit) {
						reader.cancel("body too large").catch(() => {})
						tooLarge(limit)
					}

					// writer.write can buffer; flushing after each chunk keeps
					// this bounded even for a very fast client
					writer.write(value)
					await writer.flush()
				}
			} finally {
				reader.releaseLock()
			}
		}

		await writer.end()
		finished = true
		return { path, size }
	} finally {
		if (!finished) {
			// an error, a cancellation or a too-large body: don't leave the
			// partial upload around
			try {
				await writer.end()
			} catch {}
			await unlink(path).catch(() => {})
		}
	}
}

/** Counts and streams a request body to a temporary file. */
export async function streamToTempFile(
	request: Request,
	limit: number,
	dir: string,
	name = "upload"
) {
	rejectDeclaredBodyOver(request, limit)
	return streamBodyToTempFile(request.body, limit, dir, name)
}

/** Counts and streams an upstream response to a temporary file. */
export async function streamResponseToTempFile(
	response: Response,
	limit: number,
	dir: string,
	name = "download"
) {
	rejectDeclaredBodyOver(response, limit)
	return streamBodyToTempFile(response.body, limit, dir, name)
}

/** md5 of a file, streamed so large assets don't sit in memory. */
export async function hashFile(path: string) {
	const hash = createHash("md5")
	for await (const chunk of createReadStream(path)) hash.update(chunk)
	return hash.digest("hex")
}

/** The temporary file's first bytes, without reading the whole place. */
export async function fileHead(path: string, length: number) {
	return new Uint8Array(
		await Bun.file(path).slice(0, length).arrayBuffer()
	)
}
