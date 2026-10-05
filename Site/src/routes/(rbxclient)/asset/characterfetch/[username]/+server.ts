import { error } from "@sveltejs/kit"
import config from "$lib/server/config"
import { siteOrigin } from "$lib/server/origin"
import { db } from "$lib/server/surreal"
import userQuery from "./user.surql"
import { requireAssetAccess } from "$lib/server/assetAuth"

type User = {
	bodyColours: {
		Head: number
		Torso: number
		LeftArm: number
		RightArm: number
		LeftLeg: number
		RightLeg: number
	}
	wearing: number[]
}

export async function GET({ params, locals, request }) {
	requireAssetAccess(locals, request)

	const { username } = params
	const [[user]] = await db.query<User[][]>(userQuery, { username })
	if (!user) error(404, "User not found")

	// the version parameter stops long-lived Aya.Server processes (renders,
	// gameservers) reusing body colours cached from an earlier fetch
	let charApp = `http://${config.DomainInsecure}/asset/bodycolors.ashx?username=${username}&v=${Date.now()}`
	for (const asset of user.wearing)
		charApp += `;${siteOrigin()}/asset?id=${asset}`

	return new Response(charApp, {
		headers: {
			Pragma: "no-cache",
			"Cache-Control": "no-cache",
			"Content-Type": "text/plain",
		},
	})
}
