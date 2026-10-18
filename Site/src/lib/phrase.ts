// Recovery phrase sign-in. Every account has a 12-word BIP39 phrase, like a
// crypto wallet. The browser turns the phrase into an Ed25519 key pair and
// signs one-time challenges from the Site with it; the Site only ever stores
// the public key, so the phrase never leaves the player's device.
// lib/server/phrase.ts issues and checks the challenges.

import { ed25519 } from "@noble/curves/ed25519.js"
import { hkdf } from "@noble/hashes/hkdf.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js"
import {
	generateMnemonic,
	mnemonicToSeed,
	mnemonicToSeedWebcrypto,
	validateMnemonic,
} from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english.js"

export { wordlist }

/** Words in a phrase: 128 bits of randomness, the usual wallet size */
export const phraseLength = 12

/** What a challenge is for, so a signature for one thing can't be used for another */
export type Purpose = "login" | "register" | "phrase" | "replace" | "reset"

export const newPhrase = () => generateMnemonic(wordlist, 128)

/** Lowercase, single-spaced words, so pasted or retyped phrases still match */
export const normalise = (phrase: string) =>
	phrase.trim().toLowerCase().split(/\s+/).join(" ")

/** Whether every word is in the list and the phrase's checksum is right */
export const validPhrase = (phrase: string) =>
	validateMnemonic(normalise(phrase), wordlist)

const known = new Set(wordlist)
export const isWord = (word: string) => known.has(word.toLowerCase())

/** The bytes a key signs to answer a challenge */
export const challengeMessage = (purpose: Purpose, nonce: string) =>
	utf8ToBytes(`Mercury sign-in\n${purpose}\n${nonce}`)

/**
 * The sign-in key for a phrase: the BIP39 seed, narrowed to an Ed25519 key
 * just for Mercury.
 * @returns The public key (hex) to store, and a function to answer challenges.
 * @example
 * const key = await keyFromPhrase(phrase)
 * const signature = key.sign("login", nonce)
 */
export async function keyFromPhrase(phrase: string) {
	const words = normalise(phrase)
	// WebCrypto is much faster, but only exists on https or localhost
	const seed = globalThis.crypto?.subtle
		? await mnemonicToSeedWebcrypto(words)
		: await mnemonicToSeed(words)
	const secret = hkdf(
		sha256,
		seed,
		utf8ToBytes("Mercury"),
		utf8ToBytes("sign-in key v1"),
		32
	)
	return {
		publicKey: bytesToHex(ed25519.getPublicKey(secret)),
		sign: (purpose: Purpose, nonce: string) =>
			bytesToHex(ed25519.sign(challengeMessage(purpose, nonce), secret)),
	}
}
