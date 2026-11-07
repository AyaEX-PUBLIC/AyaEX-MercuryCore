import { redirect } from "@sveltejs/kit"
import { type } from "arktype"
import { authorise } from "$lib/server/auth"
import formError from "$lib/server/formError"
import {
	createPlace,
	freePlaces,
	nextPlacePrice,
	placeCost,
	placeCount,
	placeLimit,
} from "$lib/server/places"
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
	// what the page said the game costs, so it's never more than that
	price: "number.integer >= 0 = 0",
})

export async function load({ locals }) {
	const { user } = await authorise(locals)
	const count = await placeCount(user.id)
	const price = nextPlacePrice(user, count)
	return {
		form: await superValidate({ price }, arktype(schema), {
			errors: false,
		}),
		places: {
			count,
			// administrators have no limit and pay nothing
			limit: user.permissionLevel >= 5 ? null : placeLimit,
			price,
			free: freePlaces,
			cost: placeCost,
		},
	}
}

export const actions: import("./$types").Actions = {}
actions.default = async ({ fetch, locals, request }) => {
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

	// (only administrators can set the selfhosted server address)
	const { maxPlayers, privateServer, serverAddress, serverPort, price } =
		form.data
	const created = await createPlace(
		fetch,
		user,
		{
			name,
			description,
			maxPlayers,
			privateServer,
			serverAddress,
			serverPort,
		},
		price
	)
	if ("error" in created) return formError(form, ["other"], [created.error])

	redirect(302, `/place/${created.id}/${slug}`)
}
