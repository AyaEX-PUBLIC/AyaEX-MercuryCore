// Configuration file for Mercury Core. Hover over a property to see its description!
// If you're running in production, you'll need to rebuild Mercury Core to apply changes.

export default {
	Name: "AyaEX",
	Domain: "mercury.nodium.lol",
	DomainInsecure: "mercury.nodium.lol",
	RCCServiceProxyURL: "http://localhost:64990",
	LauncherURI: "mercury-launcher:",
	WebPlayerURL: "/runtime?apptype=player",
	CurrencySymbol: "屌",
	Pages: ["Statistics", "Groups"],

	Database: {
		AutoStart: false,
		Domain: "localhost:8000",
	},

	Economy: {
		AutoStart: false,
	},

	Orbiter: {
		PrivateURL: "http://localhost:64991",
		PublicURL: "/orbiter", // path on the Site (Caddy proxies it), works from any address
	},

	// 'noob' colours
	DefaultBodyColors: {
		Head: 24,
		LeftArm: 24,
		LeftLeg: 119,
		RightArm: 24,
		RightLeg: 119,
		Torso: 23,
	},

	Logging: {
		Requests: true,
		FormattedErrors: false,
		Time: true,
		DiscordModerationWebhook: "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
	},

	Branding: {
		Favicon: "Branding/Favicon.png",
		Icon: "Branding/Icon.png",
		Tagline: "Old clients, new tricks",
		LongTagline: "Roblox slopvival",
		Descriptions: {
			"Same nostalgia":
				"Virtual versions recreate the Roblox clients from 2010 to 2016, with a handful of modern features backported.",
			"New features":
				"Switch client versions mid-game, put live web pages on in-game screens with StreamingFrames, and try Freaky Mode if you dare.",
			"Better security":
				"Nothing to download or install: the client runs inside your browser's sandbox. You sign in with a 12-word recovery phrase instead of a password, and it never leaves your browser.",
		},
	},

	Images: {
		DefaultPlaceIcons: ["Images/DefaultIcon1.avif"],
		DefaultPlaceThumbnails: [
			"Images/DefaultThumbnail1.avif",
			"Images/DefaultThumbnail2.avif",
			"Images/DefaultThumbnail3.avif",
		],
	},

	Themes: [
		{
			Name: "Standard",
			Path: "Themes/Standard.css",
		},
	],

	Filtering: {
		FilteredWords: [],
		ReplaceWith: "#",
		ReplaceType: "Character",
	},

	Registration: {
		Keys: {
			Enabled: true,
			Prefix: "ayaex-",
			// invite codes given out as AyaWASM still work
			OldPrefixes: ["ayawasm-"],
		},
		Emails: false,
	},

	Email: {
		Host: "smtp.example.com",
		Port: 465,
		Secure: true,
		Username: "username",
	},

	Gameservers: {
		Hosting: "Dedicated",
	},
} satisfies import("./Assets/schema.ts").Config
