import { redirect } from "@sveltejs/kit"
import { type } from "arktype"
import { authorise } from "$lib/server/auth"
// import { createPlace, getPlacePrice } from "$lib/server/economy"
import formError from "$lib/server/formError"
import { createPlace, placeLimit } from "$lib/server/places"
import { arktype, superValidate } from "$lib/server/validate"
import {
	maxPlayersTest,
	serverAddressTest,
	serverPortTest,
} from "$lib/typeTests"
import { encode } from "$lib/urlName"

const schema = type({
	name: "3 <= string <= 50",
	description: "string <= 1000",
	serverAddress: serverAddressTest.default("localhost"),
	// eh, works well enough and the built-in z.string().url() requires a protocol
	serverPort: serverPortTest.default(53640),
	maxPlayers: maxPlayersTest.default(10),
	privateServer: "boolean | undefined",
})

export async function load() {
	// const price = getPlacePrice()
	return {
		form: await superValidate(arktype(schema)),
		// count: await placeCount((await authorise(locals)).user.id),
		// price,
	}
}

export const actions: import("./$types").Actions = {}
actions.default = async ({ locals, request }) => {
	const { user } = await authorise(locals)
	const form = await superValidate(request, arktype(schema))
	if (!form.valid) return formError(form)

	const name = form.data.name.trim()
	if (!name) return formError(form, ["name"], ["Place must have a name"])
	const description = form.data.description.trim()
	if (!description)
		return formError(
			form,
			["description"],
			["Place must have a description"]
		)
	const slug = encode(name)

	// const created = await createPlace(f, user.id, id, name, slug)
	// if (!created.ok) return formError(form, ["other"], [created.msg])

	// (only administrators can set the selfhosted server address)
	const { maxPlayers, privateServer, serverAddress, serverPort } = form.data
	const id = await createPlace(user, {
		name,
		description,
		maxPlayers,
		privateServer,
		serverAddress,
		serverPort,
	})
	if (!id)
		return formError(
			form,
			["other"],
			[`You can't have more than ${placeLimit} places`]
		)

	redirect(302, `/place/${id}/${slug}`)
}
