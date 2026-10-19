// Console clients offered on /download. The files live in data/downloads (not
// in git); deploy/deploy.sh copies the latest builds there.
export const clients = {
	switch: { path: "../data/downloads/Aya.Switch.nro", name: "Aya.Switch.nro" },
}

/** A client's size and build time, or null if it isn't there */
export async function clientFile(client: keyof typeof clients) {
	const file = Bun.file(clients[client].path)
	if (!(await file.exists())) return null
	return { name: clients[client].name, size: file.size, updated: file.lastModified }
}
