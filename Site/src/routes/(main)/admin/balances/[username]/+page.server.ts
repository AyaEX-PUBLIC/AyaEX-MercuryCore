import { error, fail } from "@sveltejs/kit"
import { authorise } from "$lib/server/auth"
import {
	burn,
	economyConnFailed,
	getBalance,
	getTransactions,
	mint,
	transformTransactions,
} from "$lib/server/economy"
import { db, Record } from "$lib/server/surreal"

// An administrator's view of one user's currency: their balance (which can be
// changed), their whole currency history, and everything they've acquired.

const UNIT = 1_000_000

type Target = BasicUser & { id: string; permissionLevel: number; created: string; lastOnline: string }
type Owned = {
	asset: number
	name: string
	type: number
	price: number
	created: string
	creator?: string
	place?: number
}
type Receipt = {
	id: string
	product: number
	name: string
	place: number
	placeName: string
	price: number
	created: string
	completed?: string
}

async function findUser(username: string) {
	const [[user]] = await db.query<Target[][]>(
		`SELECT record::id(id) AS id, username, status, permissionLevel, created, lastOnline
		FROM user WHERE username = $username`,
		{ username }
	)
	if (!user) error(404, "User not found")
	return user
}

export async function load({ fetch: f, locals, params }) {
	await authorise(locals, 5)
	const user = await findUser(params.username)

	const [balance, transactions, [owned, receipts]] = await Promise.all([
		getBalance(f, user.id),
		getTransactions(f, user.id, 2000),
		db.query<[Owned[], Receipt[]]>(
			`SELECT record::id(out) AS asset, out.name AS name, out.type AS type, out.price AS price,
				created, (out<-created<-user.username)[0] AS creator,
				IF out.place THEN record::id(out.place) END AS place
			FROM ownsAsset WHERE in = $user ORDER BY created DESC;
			SELECT record::id(id) AS id, record::id(product) AS product, product.name AS name,
				record::id(place) AS place, place.name AS placeName, price, created, completed
			FROM productReceipt WHERE user = $user ORDER BY created DESC;`,
			{ user: Record("user", user.id) }
		),
	])
	if (!balance.ok || !transactions.ok) error(500, economyConnFailed)

	return {
		target: user,
		balance: balance.value,
		...(await transformTransactions(transactions.value)),
		owned,
		receipts,
	}
}

export const actions: import("./$types").Actions = {}
actions.adjust = async ({ fetch: f, locals, params, request }) => {
	const { user: admin } = await authorise(locals, 5)
	const target = await findUser(params.username)

	const form = await request.formData()
	const mode = form.get("mode")
	const amount = Number(form.get("amount"))
	const reason = String(form.get("reason") ?? "").trim().slice(0, 200)
	// whole and fractional amounts, to the micro-unit
	const micro = Math.round(amount * UNIT)
	if (!Number.isFinite(amount) || micro < 0 || micro > 1e9 * UNIT)
		return fail(400, { adjust: "Enter an amount from 0 to 1,000,000,000" })
	if (mode !== "set" && micro === 0) return fail(400, { adjust: "Enter an amount above 0" })

	const current = await getBalance(f, target.id)
	if (!current.ok) return fail(500, { adjust: economyConnFailed })
	const change = mode === "add" ? micro : mode === "remove" ? -micro : mode === "set" ? micro - current.value : NaN
	if (Number.isNaN(change)) return fail(400, { adjust: "Unknown action" })
	if (change === 0) return { adjust: "The balance is already that amount" }
	if (-change > current.value)
		return fail(400, { adjust: `${target.username} only has ${current.value / UNIT}, so that much can't be removed` })

	const note = `Adjusted by an administrator${reason ? `: ${reason}` : ""}`
	const result =
		change > 0 ? await mint(f, target.id, change, note) : await burn(f, target.id, -change, note, "/economy", {})
	if (!result.ok) return fail(400, { adjust: `The Economy service refused: ${result.msg}` })

	const readable = (n: number) => (n / UNIT).toLocaleString("en-US", { maximumFractionDigits: 6 })
	await db.run("fn::auditLog", [
		"Economy",
		`${change > 0 ? "Added" : "Removed"} ${readable(Math.abs(change))} ${change > 0 ? "to" : "from"} ${target.username} (${readable(current.value)} → ${readable(current.value + change)})${reason ? `: ${reason}` : ""}`,
		Record("user", admin.id),
	])

	return { adjust: `Balance changed from ${readable(current.value)} to ${readable(current.value + change)}`, ok: true }
}
