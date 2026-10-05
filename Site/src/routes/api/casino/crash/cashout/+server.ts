import { casinoResponse, cashOutCrash } from "$lib/server/casino"

export const POST = ({ fetch: f, locals }) => casinoResponse(locals, user => cashOutCrash(f, user))
