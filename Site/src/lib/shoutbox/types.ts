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

export type Shout = {
	id: string
	channel: string
	author: { username: string; level: number }
	body: string
	created: number
	edited: number | null
}
