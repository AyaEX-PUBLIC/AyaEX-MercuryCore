// Aya client channels. Caddy (Caddyfile.aya) serves /runtime from the
// directory of the channel named in this cookie; it defaults to stable.
export const clientChannels = ["stable", "dev"] as const
export type ClientChannel = (typeof clientChannels)[number]

export const defaultClientChannel: ClientChannel = "stable"
export const clientChannelCookie = "ayaClientChannel"

export const clientChannelInfo: Record<ClientChannel, string> = {
	stable: "A tested client build. It stays available while a new client is being built.",
	dev: "The newest client build, updated as soon as it's compiled. It can be unavailable or broken while a build is linking.",
}
