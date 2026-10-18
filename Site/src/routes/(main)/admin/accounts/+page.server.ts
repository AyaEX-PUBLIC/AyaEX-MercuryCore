import { fail } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import { issueResetCode } from "$lib/server/resetCode"
import { db, Record, type RecordId } from "$lib/server/surreal"
import usersQuery from "./users.surql"

export async function load({ locals }) {
	await authorise(locals, 4)

	const [users] =
		await db.query<(BasicUser & { hasPhrase: boolean })[][]>(usersQuery)

	return { users }
}

export const actions: import("./$types").Actions = {}
// Accounts sign in with recovery phrases, which administrators never see. If
// someone loses theirs, give them a one-time code to make a new one with.
actions.resetCode = async ({ locals, request }) => {
	const { user } = await authorise(locals, 5)
	const username = String((await request.formData()).get("username") || "")
		.trim()
		.slice(0, 50)

	const [[target]] = await db.query<
		{ id: RecordId<"user">; username: string }[][]
	>(
		"SELECT id, username FROM user WHERE string::lowercase(username) = string::lowercase($username) LIMIT 1",
		{ username }
	)
	if (!target)
		return fail(404, { username, error: "No user has that username" })

	const code = await issueResetCode(target.id)
	await db.run("fn::auditLog", [
		"Account",
		`Issue a recovery phrase reset code for ${target.username}`,
		Record("user", user.id),
	])

	return { username: target.username, code }
}
