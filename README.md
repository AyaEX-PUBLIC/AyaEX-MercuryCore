<p align="center"><img src="Assets/Branding/Icon.png" width="112" alt="AyaEX logo"></p>

# AyaEX (Aya Extended)

**AyaEX is an improved fork of two projects, made to work as one:**

| Part | Upstream project | AyaEX fork |
| --- | --- | --- |
| Website, accounts, economy, game hosting | [Mercury Core](https://github.com/tp-link-extender/MercuryCore) | [AyaEX-MercuryCore](https://github.com/AyaEX-PUBLIC/AyaEX-MercuryCore) (this repository) |
| Game client: Player, Studio, gameservers | Aya, the Kiseki project's 2016 client | the AyaEX client, prebuilt in [AyaEX](https://github.com/AyaEX-PUBLIC/AyaEX) |
| Gameserver orchestration (Orbiter, RCC proxy) | [RCCService](https://github.com/tp-link-extender/RCCService) | [AyaEX-MercuryRCC](https://github.com/AyaEX-PUBLIC/AyaEX-MercuryRCC) |

Players sign in on the website and play in their browser: the Player and Studio
are the AyaEX client compiled to WebAssembly, so there is nothing to download.
Gameservers and avatar renders are native AyaEX `Aya.Server` processes, run by
the Orbiter and RCC proxy from `../MercuryRCC`. Nintendo Switch and Wii U apps
sign into the same site.

AyaEX was called AyaWASM until October 2026.

> [!NOTE]
> Mercury Core is a build-your-own-Roblox website. Aya is a heavily modified
> fork of the Roblox client code leaked in 2016. AyaEX is not affiliated with
> Roblox Corporation.

## Contents

- [Public repositories](#public-repositories)
- [What AyaEX changes in Mercury Core](#what-ayaex-changes-in-mercury-core)
- [What AyaEX changes in Aya](#what-ayaex-changes-in-aya)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Developing](#developing)
- [Customisation](#customisation)
- [The stack](#the-stack)
- [Credits](#credits)

## Public repositories

| Repository | What |
| --- | --- |
| [AyaEX-PUBLIC/AyaEX-MercuryCore](https://github.com/AyaEX-PUBLIC/AyaEX-MercuryCore) | This repository: the website, the Economy service, and the setup and deployment scripts |
| [AyaEX-PUBLIC/AyaEX-MercuryRCC](https://github.com/AyaEX-PUBLIC/AyaEX-MercuryRCC) | The Orbiter and RCC proxy, which run gameservers and avatar renders |
| [AyaEX-PUBLIC/AyaEX](https://github.com/AyaEX-PUBLIC/AyaEX) | Prebuilt AyaEX clients and server: the WebAssembly Player and Studio, the Switch and Wii U apps, and `Aya.Server` for Linux |

These are downstream mirrors. AyaEX is developed in a private, self-hosted Git
repository, and the public repositories are updated from it, so they can be
behind it.

## What AyaEX changes in Mercury Core

**Aya as the client.** Upstream Mercury Core leaves the client to you. Here
the Play button opens the AyaEX Player in the browser, with a signed join ticket
that the gameserver checks before the player joins. Gameservers start on
demand. Players choose a stable or dev client channel, and the operator promotes
tested builds to stable with `aya/promote-stable.sh`. Studio runs in the browser, opens your games,
and publishes to them.

**Accounts.**

- Sign-in uses a 12-word recovery phrase instead of a password. The browser
  derives a key from it, and the site only stores the public key.
- Administrators can issue reset codes for lost phrases.
- The Switch app signs in with a short code approved on `/device`.

**Invites.**

- An invite tree shows who invited whom.
- People without an invite can send an application.
- Members can buy invites with weekly limits. Administrators configure all of
  this.

**Community.**

- A live shoutbox with channels and safe formatting.
- A News section that administrators write in Markdown.
- In-game abuse reports that land in the moderation queue.

**Games.**

- Private places and links.
- R6 or R15 avatars per place.
- Game passes, developer products and badges.
- Place owners get the in-game server console.
- Playtime rewards.
- Friends and follows in game.
- StreamingFrames, which show live web pages on in-game screens.

**Economy.** A casino, and an Economy service that only takes requests carrying
the site's key.

**Look.** A redesigned dark, blocky interface with an orange accent, laid out
like the legacy Aya/Kiseki site.

**Operations.**

- `deploy/deploy.sh` puts the whole stack on a VPS behind Cloudflare.
- A Discord bot handles invites and look-ups.
- The site has had security audits and fixes, such as per-place file tokens,
  per-account rate limits and frame protection.

## What AyaEX changes in Aya

- **One WebAssembly app for Player, Server and Studio.** It runs in the browser,
  and the site serves it from `/runtime`.
- **Browser-hosted games.** A browser tab can host a game, joined with a 9-digit
  code.
- **Virtual versions.** Players switch between the 2010 to 2016 client looks
  mid-game, and there's Freaky Mode.
- **DataStores without a backend.**
- **Nintendo Switch and Wii U homebrew ports.**
- **Mercury integration.** The gameserver checks join tickets, the engine uses
  an access key for its own site requests, and place scripts' HTTP requests are
  limited to allowlisted hosts.

The client's source isn't public. Its builds are in
[AyaEX](https://github.com/AyaEX-PUBLIC/AyaEX): the WebAssembly app, the Switch
and Wii U apps, and `Aya.Server` for Linux.

## Getting started

The full guide, with ports, services, client channels and every feature's
notes, is [`aya/README.md`](aya/README.md). You need Docker, Bun and Go, with
two folders beside this repository:

- `../MercuryRCC`: a clone of
  [AyaEX-MercuryRCC](https://github.com/AyaEX-PUBLIC/AyaEX-MercuryRCC).
- `../aya-dev`: the AyaEX client and server. Unpack the archives from the
  [AyaEX releases](https://github.com/AyaEX-PUBLIC/AyaEX/releases) there. They
  are laid out like the client's build tree, so nothing else needs to change.

```bash
cp Site/.env.example Site/.env       # then fill it in (keys, ORIGIN)
aya/setup-data.sh                    # loadscripts, render scripts, signing key, stable client into data/
docker compose up -d --build         # database, economy, site, caddy
../MercuryRCC/run.sh                 # RCC proxy + Orbiter (from a desktop session: renders need DISPLAY)
```

Then open <http://localhost:8010> and register. The first account becomes the
administrator and needs no invite. To change the public address, use
`aya/set-domain.sh`. To deploy to a VPS, see
[Deploying to a VPS](aya/README.md#deploying-to-a-vps).

## Repository layout

| Path | What |
| --- | --- |
| `mercury.core.ts` | Site configuration (name, domain, branding, registration, …) |
| `Site/` | The SvelteKit website; `Site/src/lib/server/init.surql` is the database schema |
| `Economy/` | The Go currency service (ledger, balances, transfers) |
| `Caddyfile.aya` | Reverse proxy on :8010: site, `/runtime`, gameserver and Orbiter paths |
| `compose.yml` | Database, Economy, site, Caddy, and the Discord bot (profile `discord`) |
| `aya/` | AyaEX setup scripts (`setup-data.sh`, `set-domain.sh`, `promote-stable.sh`) and the guide |
| `deploy/` | VPS deployment (`deploy.sh`, Caddy and systemd templates) |
| `DiscordBot/` | Bun and discord.js bot: `/invite`, `/getuser`, `/autoadd` |
| `Assets/` | Branding, themes and default images |

## Developing

For a dev server, go to **Site**, run `bun i`, then
`bun x -b vite dev --port 5180`, and open the link it prints. It uses the real
database and applies `init.surql` on start. Production builds come from
`docker compose up -d --build site`.

The **data** directory is not in git and should be kept private:

- the database (`data/surreal`)
- the economy ledger and key (`data/economy`)
- assets and thumbnails
- place icons and news covers
- loadscripts
- the script-signing key (`data/PrivateKey.pem`)

Secrets belong in `.env` files, never in `mercury.core.ts`.

## Customisation

Most settings are in **mercury.core.ts**: the site's name, domain, branding,
registration rules, and more. Properties are checked against a schema, so you
can hover over them to see what they do. Themes are CSS files in
**Assets/Themes**.

For anything deeper, edit the code. The codebase aims to be modular and
consistent. The stack is described below.

## The stack

- **[Svelte](https://svelte.dev) and [SvelteKit](https://kit.svelte.dev):** the
  frontend, compiled to plain JavaScript, and a full-stack framework for pages,
  forms and APIs. Pages live in **Site/src/routes**. See the
  [routing docs](https://kit.svelte.dev/docs/routing).
- **[TypeScript](https://www.typescriptlang.org):** used throughout.
- **[SurrealDB](https://surrealdb.com):** the database, a multi-model database
  suited to the site's highly relational data.
- **[Bun](https://bun.sh) and [Vite](https://vitejs.dev):** run and build the
  site.
- **[Caddy](https://caddyserver.com):** the reverse proxy, with automatic HTTPS,
  URL rewriting and the cross-origin isolation headers the WebAssembly client
  needs.

## Credits

- **Mercury Core** is by tp-link-extender and contributors
  ([upstream repository](https://github.com/tp-link-extender/MercuryCore)).
  This fork keeps its [Unlicense](UNLICENSE).
- **Aya** comes from the Kiseki project's 2016 client.
- **AyaEX** is the combined, improved fork of both.
