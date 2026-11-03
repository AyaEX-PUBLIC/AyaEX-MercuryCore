const xmlStart = "<roblox "

export const isXML = (buf: ArrayBuffer | Uint8Array) => {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
	return (
		// binary places also start with "<roblox" ("<roblox!\x89\xff..."),
		// the 8th byte is where they differ: '!' for binary, ' ' for XML
		bytes.byteLength >= 8 &&
		bytes
			.subarray(0, 8)
			.every((b, i) => b === xmlStart.charCodeAt(i))
	)
}
