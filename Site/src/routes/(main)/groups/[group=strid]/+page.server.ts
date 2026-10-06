import { error, fail } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import exclude from "$lib/server/exclude"
import { hashedGroupId, type JoinMode, joinModes } from "$lib/server/groups"
import { db, Record } from "$lib/server/surreal"
import type { RequestEvent } from "./$types.d"
import groupQuery from "./group.surql"
import joinQuery from "./join.surql"
import leaveQuery from "./leave.surql"
import manageQuery from "./manage.surql"

type Group = {
	id: string
	name: string
	joinMode: JoinMode
	engineId?: number
	owner: BasicUser
	owned: boolean
	memberCount: number
	in: boolean
	invited: boolean
}
type Manage = {
	members: (BasicUser & { created: string })[]
	invites: (BasicUser & { inviter: string; created: string })[]
}

async function getGroup(user: User, id: string) {
	const [[group]] = await db.query<Group[][]>(groupQuery, {
		user: Record("user", user.id),
		group: Record("group", id),
	})
	if (!group) error(404, "Not Found")
	// the owner and site administrators manage a group
	return { ...group, canManage: group.owned || user.permissionLevel >= 5 }
}

export async function load({ locals, params }) {
	exclude("Groups")
	const { user } = await authorise(locals)
	const group = await getGroup(user, params.group)

	let manage: Manage | undefined
	if (group.canManage)
		[[manage]] = await db.query<Manage[][]>(manageQuery, { group: Record("group", params.group) })

	return {
		...group,
		engineGroupId: group.engineId ?? hashedGroupId(group.id),
		joinModes,
		manage,
	}
}

async function getData({ locals, params }: RequestEvent) {
	exclude("Groups")
	const { user } = await authorise(locals)
	const group = await getGroup(user, params.group)
	return {
		user,
		group,
		params: { user: Record("user", user.id), group: Record("group", params.group) },
	}
}

async function manager(e: RequestEvent) {
	const data = await getData(e)
	if (!data.group.canManage) error(403, "Only the group's owner can do that")
	return data
}

async function findUsername(form: FormData) {
	const username = String(form.get("username") ?? "").trim()
	const [[found]] = await db.query<{ id: string; username: string }[][]>(
		"SELECT record::id(id) AS id, username FROM user WHERE string::lowercase(username) = string::lowercase($username)",
		{ username }
	)
	return found
}

export const actions: import("./$types").Actions = {}
actions.join = async e => {
	const { group, params } = await getData(e)
	if (group.in) return
	if (group.joinMode === "closed") return fail(400, { msg: "This group isn't accepting new members" })
	if (group.joinMode === "invite" && !group.invited) return fail(400, { msg: "This group is invite only" })
	await db.query(joinQuery, params)
}
actions.leave = async e => {
	const { group, params } = await getData(e)
	if (group.owned) return fail(400, { msg: "The owner can't leave their group" })
	await db.query(leaveQuery, params)
}
actions.decline = async e => {
	const { params } = await getData(e)
	await db.query("DELETE $group->groupInvite WHERE out = $user", params)
}

actions.settings = async e => {
	const { params } = await manager(e)
	const mode = String((await e.request.formData()).get("joinMode"))
	if (!(mode in joinModes)) return fail(400, { msg: "Unknown join setting" })
	await db.query("UPDATE $group SET joinMode = $mode", { ...params, mode })
	return { msg: "Saved" }
}
actions.invite = async e => {
	const { user, group, params } = await manager(e)
	if (group.joinMode === "closed")
		return fail(400, { msg: "The group is closed; make it invite only to invite people" })
	const invitee = await findUsername(await e.request.formData())
	if (!invitee) return fail(400, { msg: "No user with that username" })

	const [already] = await db.query<[boolean, boolean][]>(
		"RETURN [$invitee IN $group<-member<-user, $invitee IN $group->groupInvite->user]",
		{ ...params, invitee: Record("user", invitee.id) }
	)
	if (already[0]) return fail(400, { msg: `${invitee.username} is already a member` })
	if (already[1]) return fail(400, { msg: `${invitee.username} is already invited` })

	await db.query(
		`RELATE $group->groupInvite->$invitee SET inviter = $user;
		fn::notify($user, $invitee, "GroupInvite", $note, $groupId);`,
		{
			...params,
			invitee: Record("user", invitee.id),
			groupId: group.id,
			note: `${user.username} invited you to join ${group.name}.`,
		}
	)
	return { msg: `Invited ${invitee.username}` }
}
actions.revoke = async e => {
	const { params } = await manager(e)
	const invitee = await findUsername(await e.request.formData())
	if (!invitee) return fail(400, { msg: "No user with that username" })
	await db.query(
		`DELETE $group->groupInvite WHERE out = $invitee;
		DELETE notification WHERE out = $invitee AND type = "GroupInvite" AND relativeId = $groupId AND !read;`,
		{ ...params, invitee: Record("user", invitee.id), groupId: e.params.group }
	)
}
actions.kick = async e => {
	const { params } = await manager(e)
	const member = await findUsername(await e.request.formData())
	if (!member) return fail(400, { msg: "No user with that username" })
	const memberRecord = Record("user", member.id)
	const [isOwner] = await db.query<boolean[]>("RETURN $member IN $group<-ownsGroup<-user", {
		...params,
		member: memberRecord,
	})
	if (isOwner) return fail(400, { msg: "The owner can't be removed" })
	await db.query("DELETE $member->member WHERE out = $group", { ...params, member: memberRecord })
	return { msg: `Removed ${member.username}` }
}
