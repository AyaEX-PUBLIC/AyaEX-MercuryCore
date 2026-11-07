// Console clients offered on /download. The files live in data/downloads (not
// in git); deploy/release.sh takes them from there and deploy/deploy.sh puts
// them on the VPS.

import { error } from "@sveltejs/kit"

export const clients = {
	switch: { path: "../data/downloads/Aya.Switch.nro", name: "Aya.Switch.nro" },
	wiiu: { path: "../data/downloads/AyaEX.wuhb", name: "AyaEX.wuhb" },
}

export type Client = keyof typeof clients

/** A client's size and build time, or null if it isn't there */
export async function clientFile(client: Client) {
	const file = Bun.file(clients[client].path)
	if (!(await file.exists())) return null
	return { name: clients[client].name, size: file.size, updated: file.lastModified }
}

/** The client's file, as a download */
export async function downloadClient(client: Client, consoleName: string) {
	const found = await clientFile(client)
	if (!found) error(404, `The ${consoleName} client isn't available yet`)
	return new Response(Bun.file(clients[client].path), {
		headers: {
			"Content-Type": "application/octet-stream",
			"Content-Disposition": `attachment; filename="${found.name}"`,
			"Cache-Control": "no-cache",
		},
	})
}
