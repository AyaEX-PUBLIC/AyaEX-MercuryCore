// Who can do what in the shoutbox, by permission level (lib/permissionLevels.ts).
// The server enforces these; the client uses them to show the right buttons.

import type { Channel } from "./types"

/** Moderators and administrators can delete messages, and skip slow mode */
export const staffLevel = 4
/** Administrators also manage channels */
export const adminLevel = 5

type Levels = Pick<Channel, "readLevel" | "writeLevel">

export const canRead = (channel: Levels, level: number) =>
	level >= channel.readLevel

export const canWrite = (channel: Levels, level: number) =>
	level >= Math.max(channel.readLevel, channel.writeLevel)

/** Staff can delete messages by people below them; administrators, anyone's */
export const canModerate = (authorLevel: number, level: number) =>
	level >= adminLevel || (level >= staffLevel && authorLevel < level)
