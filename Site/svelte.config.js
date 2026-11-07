import adapter from "@sveltejs/adapter-node"
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte"

/** @type {import("@sveltejs/kit").Config} */
export default {
	// Consult https://github.com/sveltejs/svelte-preprocess for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: { $components: "./src/components" },

		// Pages run only what the Site serves itself: SvelteKit puts a fresh
		// nonce on its own inline script and styles, and on the theme's style
		// (app.html), and anything else inline is refused. Style attributes
		// (style="...") stay allowed; they can't run script. Custom CSS is a
		// stylesheet of the Site's own (routes/api/usercss).
		csp: {
			mode: "auto",
			directives: {
				"default-src": ["self"],
				"script-src": ["self"],
				"style-src": ["self"],
				"style-src-attr": ["unsafe-inline"],
				"img-src": ["self", "data:", "blob:"],
				"font-src": ["self", "data:"],
				"media-src": ["self", "blob:"],
				"connect-src": ["self"],
				"worker-src": ["self", "blob:"],
				"frame-src": ["self"],
				"object-src": ["none"],
				"base-uri": ["self"],
				"form-action": ["self"],
				"frame-ancestors": ["self"],
			},
		},

		experimental: {
			remoteFunctions: true,
		},
	},
	vitePlugin: { inspector: { toggleKeyCombo: "control-i" } },

	compilerOptions: {
		// These become defaults in Svelte 6
		runes: true,
		modernAst: true,

		// shorter hashes (normal hashes are svelte-{hash}). This doesn't work in development so expect a warning from vite-plugin-svelte, though works fine in production builds.
		cssHash: ({ hash, filename }) => `s${hash(filename)}`,

		experimental: {
			async: true,
		},
	},
}
