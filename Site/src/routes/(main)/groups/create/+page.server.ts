import { error, redirect } from "@sveltejs/kit"
import { type } from "arktype"
import { authorise } from "$lib/server/auth"
import { createGroup, getGroupPrice } from "$lib/server/economy"
import exclude from "$lib/server/exclude"
import formError from "$lib/server/formError"
import { db, findWhere, Record } from "$lib/server/surreal"
import { arktype, superValidate } from "$lib/server/validate"
import createQuery from "./create.surql"

const schema = type({
	name: "3 <= string <= 40",
})

// only administrators can create groups
const canCreate = 5

export async function load({ locals }) {
	exclude("Groups")
	await authorise(locals, canCreate)
	const price = await getGroupPrice()
	return {
		form: await superValidate(arktype(schema)),
		price,
	}
}

// "create" would collide with this page's URL
const reservedNames = Object.freeze(["create", "changed", "wisely"])

export const actions: import("./$types").Actions = {}
actions.default = async ({ fetch: f, locals, request }) => {
	exclude("Groups")
	const { user } = await authorise(locals, canCreate)
	const form = await superValidate(request, arktype(schema))
	if (!form.valid) return formError(form)

	const { name } = form.data
	const lowercaseName = name.toLowerCase()
	if (reservedNames.includes(lowercaseName))
		return formError(form, ["name"], ["This group name is not available"])

	const foundGroup = await findWhere(
		"group",
		"string::lowercase(name) = $lowercaseName",
		{ lowercaseName }
	)
	if (foundGroup)
		return formError(
			form,
			["name"],
			["A group with this name already exists"]
		)

	const created = await createGroup(f, user.id, name)
	if (!created.ok) return formError(form, ["other"], [created.msg])

	const [, , , id] = await db.query<[null, null, null, string]>(createQuery, {
		name,
		user: Record("user", user.id),
	})

	redirect(302, `/groups/${id}`)
}
