import { defaultBodyLimit, readFormData } from "$lib/server/body"

/**
 * Handles form data in a simpler way.
 * @param request A request object.
 * @param limit Largest body to accept, counted while it streams.
 * @returns An object containing the form data.
 * @example
 * const data = await formData(request)
 * const { text } = data
 */
export default async function (
	request: Request,
	limit = defaultBodyLimit
) {
	const entries = Object.fromEntries(
		(await readFormData(request, limit)).entries()
	)
	const data: { [_: string]: string } = {}
	for (const i in entries)
		if (Object.hasOwn(entries, i)) data[i] = entries[i] as string

	return data
}
