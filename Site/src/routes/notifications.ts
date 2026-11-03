import { db, Record } from "$lib/server/surreal"
import notificationsQuery from "./notifications.surql"

type Notification = {
	id: string
	created: Date
	note: string
	read: boolean
	relativeId?: string
	sender: BasicUser
	type: string
	link?: string
}

/**
 * A page of the user's notifications, newest first, with links to what they're about.
 * @param options.unreadOnly Only unread ones
 * @param options.size How many on a page
 * @param options.page Which page (from 1)
 * @returns The notifications, and how many there are in all.
 */
export default async function (
	user: User | null,
	{ unreadOnly = false, size = 30, page = 1 } = {}
) {
	if (!user) return { notifications: [], count: 0 }
	const [notifications, count] = await db.query<[Notification[], number]>(
		notificationsQuery,
		{
			user: Record("user", user.id),
			unreadOnly,
			size,
			start: (page - 1) * size,
		}
	)

	for (const i of notifications)
		switch (i.type) {
			case "Follower":
			case "FriendRequest":
			case "NewFriend":
				i.link = `/user/${i.sender.username}`
				break
			case "AssetComment":
			case "CommentReply":
				// case "ForumMention":
				if (!i.relativeId) break

				i.link = `/comment/${i.relativeId}`
				break
			case "GroupInvite":
				i.link = `/groups/${i.relativeId}`
				break
			// case "AssetApproved":
			case "ItemPurchase":
				i.link = `/catalog/${i.relativeId}`
				break
			default:
				i.link = ""
		}

	return {
		notifications: notifications.map(n => {
			n.relativeId = undefined
			return n
		}),
		count,
	}
}
