export type Channel = {
	id: string
	name: string
	description: string
	/** Lowest permission level that can see the channel */
	readLevel: number
	/** Lowest permission level that can post in it */
	writeLevel: number
	/** Seconds between one person's messages; staff aren't limited */
	slowmode: number
	/** When the newest message was sent, and by whom, for unread markers */
	last: number | null
	lastBy: string | null
}

/** The message a reply is to. A deleted one's text isn't sent any more. */
export type ReplyTo =
	| { id: string; deleted: false; author: string; body: string }
	| { id: string; deleted: true }

export type Reaction = {
	emoji: string
	/** Who reacted with it, in the order they did */
	users: string[]
}

export type Shout = {
	id: string
	channel: string
	author: { username: string; level: number }
	body: string
	created: number
	edited: number | null
	replyTo: ReplyTo | null
	/** In the order each emoji was first used */
	reactions: Reaction[]
}
