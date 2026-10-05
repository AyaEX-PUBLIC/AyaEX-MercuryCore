import { casinoResponse, cashOutMinesNow } from "$lib/server/casino"

export const POST = ({ fetch: f, locals }) => casinoResponse(locals, user => cashOutMinesNow(f, user))
