// The signed-in user's custom CSS (Settings > Styling), sanitised, as a
// stylesheet of its own. Every page links it with ?v= set to a hash of the
// CSS (hooks.server.ts), so the browser keeps it until it changes.

import sanitiseCss from "$lib/userCss"

export function GET({ locals }) {
	const css = locals.user?.css ? sanitiseCss(locals.user.css).css : ""
	return new Response(css, {
		headers: {
			"Content-Type": "text/css; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": "private, max-age=31536000, immutable",
		},
	})
}
