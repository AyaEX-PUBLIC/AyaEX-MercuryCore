// Caddy (Caddyfile.aya) asks this with forward_auth before serving anything
// under /runtime, so only signed-in players can load the Aya runtime. The
// hooks have already redirected moderated accounts to /moderation and
// accounts without a recovery phrase to /migrate, and Caddy passes those
// redirects on.

const noStore = { "Cache-Control": "no-store" }

export function GET({ locals, request }) {
	if (locals.user)
		return new Response(null, { status: 204, headers: noStore })

	// opening the player itself goes to the login page; its files get a 401.
	// Neither may be cached, or the player would stay refused after logging in
	if (request.headers.get("sec-fetch-dest") === "document")
		return new Response(null, {
			status: 302,
			headers: { ...noStore, Location: "/login" },
		})
	return new Response("Log in to play", {
		status: 401,
		headers: { ...noStore, "Content-Type": "text/plain" },
	})
}
