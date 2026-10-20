// Avatar rig types. A place plays with R6 or R15 characters, or lets each
// player choose ("Both", with the avatar type from their Character page).
// Aya reads the rig from the ayaRig parameter of the CharacterAppearance URL
// (engine/network/Player.cpp).

export const placeRigTypes = Object.freeze(["Both", "R6", "R15"] as const)
export const avatarRigs = Object.freeze(["R6", "R15"] as const)

export type PlaceRigType = (typeof placeRigTypes)[number]
export type AvatarRig = (typeof avatarRigs)[number]

/** The rig a player spawns as in a place. */
export const playerRig = (
	placeRigType: string | null | undefined,
	avatarRig: string | null | undefined
): AvatarRig =>
	placeRigType === "R6" || placeRigType === "R15"
		? placeRigType
		: avatarRig === "R15"
			? "R15"
			: "R6"
