import { createSign } from "node:crypto"

/**
 * Signs a Lua script with a private key by adding a signature to the top of the script.
 * @param data The Lua script to sign.
 * @param assetId The asset ID of the script, if required.
 * @returns A signed version of the script.
 * @example
 * const signedScript = await SignScript(`print "Hello, world!"`)
 */
export async function SignScript(data: string, assetId?: number) {
	const signed = `${assetId ? `--rbxassetid%${assetId}%` : ""}\n${data}`
	const sig = createSign("sha1")
		.update(signed)
		.sign(await Bun.file("../data/PrivateKey.pem").text(), "base64")
	return `--rbxsig%${sig}%${signed}`
}

/**
 * Signs a Lua script for the Aya engine, which only runs scripts it loads with
 * loadfile (like /game/visit) behind "--ayasig%<signature>%": an RSA SHA-512
 * signature of the text after it. Its WebAssembly builds only check that the
 * header is there.
 * @param data The Lua script to sign.
 * @returns A signed version of the script.
 */
export async function SignAyaScript(data: string) {
	const sig = createSign("sha512")
		.update(data)
		.sign(await Bun.file("../data/PrivateKey.pem").text(), "base64")
	return `--ayasig%${sig}%${data}`
}

/**
 * Signs other data with a private key by adding a signature to the top of the script.
 * @param data The data to sign.
 * @returns A signed version of the data.
 * @example
 * const signedData = await SignData(`{"name": "Heliodex"}`)
 */
export async function SignData(data: string) {
	const signed = `\r\n${data}` // the \r is apparently required here
	const sig = createSign("sha1")
		.update(signed)
		.sign(await Bun.file("../data/PrivateKey.pem").text(), "base64")
	return `--rbxsig%${sig}%${signed}`
}
