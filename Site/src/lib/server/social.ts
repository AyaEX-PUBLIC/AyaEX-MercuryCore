import oneAtATime from "$lib/server/oneAtATime"
import { db, Record } from "$lib/server/surreal"

// Friends and follows for the engine (routes/(rbxclient)/game/social): the
// gameserver's FriendService reports in-game friend requests here and loads
// existing friendships when players join, and the Player's dropdown follows
// and unfollows. Same records and notifications as the profile page buttons.

type User = { id: string; username: string }

const pair = (user: User, other: User) => ({ user: Record("user", user.id), user2: Record("user", other.id) })

const friendsQuery = "array::union($user->friends->user, $user<-friends<-user)"

export async function areFriends(user: User, other: User) {
	const [friends] = await db.query<[boolean]>(`RETURN $user2 IN ${friendsQuery}`, pair(user, other))
	return friends
}

/** Which of `others` (user IDs) are friends with `user` */
export async function friendsAmong(user: string, others: string[]) {
	if (!others.length) return []
	const [ids] = await db.query<[string[]]>(
		`RETURN ${friendsQuery}.filter(|$u| $u IN $others).map(|$u| record::id($u))`,
		{ user: Record("user", user), others: others.map(id => Record("user", id)) }
	)
	return ids
}

export async function friendCount(user: string) {
	const [count] = await db.query<[number]>(`RETURN count(${friendsQuery})`, { user: Record("user", user) })
	return count
}

export async function isFollowing(follower: string, followed: string) {
	const [following] = await db.query<[boolean]>("RETURN $user2 IN $user->follows->user", {
		user: Record("user", follower),
		user2: Record("user", followed),
	})
	return following
}

export async function follow(user: User, other: User) {
	await oneAtATime("follows", () =>
		db.query(
			`IF $user2 NOT IN $user->follows->user {
				RELATE $user->follows->$user2;
				fn::notify($user, $user2, "Follower", $note, $relativeId);
			};`,
			{ ...pair(user, other), note: `${user.username} is now following you!`, relativeId: user.id }
		)
	)
}

export async function unfollow(user: User, other: User) {
	await db.query(
		`DELETE $user->follows WHERE out = $user2;
		DELETE $user->notification WHERE out = $user2 AND type = "Follower" AND !read;`,
		pair(user, other)
	)
}

/**
 * Sends a friend request, or accepts the other user's pending request (which
 * is how the engine reports an accept).
 */
export const requestFriendship = (user: User, other: User) =>
	// one at a time, like the profile page, so two can't make two friendships
	oneAtATime("friends", async () => {
		if (user.id === other.id || (await areFriends(user, other))) return
		await db.query(
			`IF $user IN $user2->request->user {
				DELETE $user2->request WHERE out = $user;
				DELETE $user->request WHERE out = $user2;
				RELATE $user2->friends->$user;
				fn::notify($user, $user2, "NewFriend", $accepted, $relativeId);
			} ELSE IF $user2 NOT IN $user->request->user {
				RELATE $user->request->$user2;
				fn::notify($user, $user2, "FriendRequest", $requested, $relativeId);
			};`,
			{
				...pair(user, other),
				relativeId: user.id,
				accepted: `${user.username} is now friends with you!`,
				requested: `${user.username} has sent you a friend request.`,
			}
		)
	})

/** Makes two users friends (both sides asked in game) */
export const makeFriends = (user: User, other: User) =>
	oneAtATime("friends", async () => {
		if (user.id === other.id || (await areFriends(user, other))) return
		await db.query(
			`DELETE $user->request WHERE out = $user2;
			DELETE $user2->request WHERE out = $user;
			RELATE $user->friends->$user2;
			fn::notify($user, $user2, "NewFriend", $note, $relativeId);`,
			{ ...pair(user, other), relativeId: user.id, note: `${user.username} is now friends with you!` }
		)
	})

export async function breakFriendship(user: User, other: User) {
	await db.query(
		`DELETE $user<-friends WHERE in = $user2;
		DELETE $user->friends WHERE out = $user2;
		DELETE $user->notification WHERE out = $user2 AND type = "NewFriend" AND !read;`,
		pair(user, other)
	)
}

/** Cancels the user's request to the other, and declines the other's request */
export async function deleteFriendRequests(user: User, other: User) {
	await db.query(
		`DELETE $user->request WHERE out = $user2;
		DELETE $user2->request WHERE out = $user;
		DELETE $user->notification WHERE out = $user2 AND type = "FriendRequest" AND !read;`,
		pair(user, other)
	)
}
