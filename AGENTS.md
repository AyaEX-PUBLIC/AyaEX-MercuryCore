# MercuryCore (Aya fork): agent instructions

Mercury Core site running with the Aya stack: the Aya WebAssembly Player in the
browser and native Aya.Server gameservers/renderers. Read `aya/README.md` for
the deployment, and `DiscordBot/README.md` for the Discord bot.

## Always commit and push

- **Commit and push every change to this repository as soon as it's done and
  verified**: one commit per addition or fix, with a message saying what changed
  and why. Don't leave work uncommitted or unpushed.
- Remote `origin` is `http://192.168.1.44:3006/Mercury-AyaWASM/MercuryCore.git`
  (branch `main`; the local branch tracks it, so `git push` works). `upstream`
  is the original `tp-link-extender/MercuryCore`.
- The companion repo `../MercuryRCC` (Orbiter + RCC proxy) follows the same
  rule. Changes there are committed and pushed there.
- Public, downstream mirrors live on GitHub under `AyaEX-PUBLIC`:
  `AyaEX-MercuryCore` (this repository), `AyaEX-MercuryRCC`, and `AyaEX` (the
  prebuilt clients and server, from `deploy/public-release.sh`; the engine
  source stays private). The remote `public` points at the mirror. Update them
  only when asked, and only after a secret scan of what's new: everything
  pushed there is public for good (see Public releases in `aya/README.md`).

## Never commit secrets

These stay out of git (they're ignored; keep it that way):

- `Site/.env`: `RCC_KEY`, `GAMESERVER_KEY`, `ASSET_KEY` and
  `DISCORD_MODERATION_WEBHOOK`. Secrets belong in `.env` files, never in
  `mercury.core.ts`.
- `DiscordBot/.env`: the bot token.
- `data/`: the database, places, assets, `PrivateKey.pem` and test accounts.

Before committing, check the diff for tokens, keys, webhook URLs and cookies.

## Layout

| Path | What |
| --- | --- |
| `mercury.core.ts` | Site configuration (baked into the Site image) |
| `Site/` | SvelteKit site; `Site/src/lib/server/init.surql` is the database schema, applied on startup |
| `Caddyfile.aya` | reverse proxy on :8010 (`/runtime` = Aya player, `/gameserver/*` and `/orbiter/*` = Orbiter, `/streaming/ws` = the Site's StreamingFrame relay) |
| `compose.yml` | database, economy, site, caddy, and `discordbot` (profile `discord`) |
| `aya/` | `data/` templates (`setup-data.sh`), `set-domain.sh`, `import-aya-catalog.py`, README |
| `DiscordBot/` | Bun + discord.js bot: `/invite`, `/getuser`, `/autoadd` |

## Working on it

- Rebuild the Site after code or `mercury.core.ts` changes:
  `docker compose up -d --build site`. Changes to `Site/.env` only need
  `docker compose up -d --force-recreate site`.
- Bot: `docker compose --profile discord up -d --build discordbot`. Typecheck it
  with `bunx tsc --noEmit` in `DiscordBot/`.
- Deploy to the VPS with `deploy/deploy.sh` (settings in `deploy/vps.env`,
  never committed; see "Deploying to a VPS" in `aya/README.md`).
- Change the public address with `aya/set-domain.sh <url>`. It keeps `Domain`,
  `DomainInsecure`, `ORIGIN` and the Aya.Server allowlist in sync. Afterwards,
  restart the RCC services while nobody is playing.
- The database runs in strict mode: define new tables and fields
  (`DEFINE ... OVERWRITE`) before using them. In a `SELECT`, the `ORDER BY`
  field must also be selected.
- Accounts sign in with a 12-word BIP39 recovery phrase: the browser derives
  an Ed25519 key and signs challenges from `/api/auth`; the Site only stores
  the public key (`Site/src/lib/phrase.ts`, `lib/server/phrase.ts`). Accounts
  without one are forced to `/migrate`. Admin > Sign-in ends password sign-in
  for good (it deletes every password), so never use it to test. The test
  accounts' phrases are in `data/test-account.txt`. The Switch app signs in
  with a code approved on `/device`.
- Asset routes need a session or the `accesskey` header (`ASSET_KEY`).
  Place files (`/asset/?id=<place>`, `/game/<place>`) are only for that key
  with the place's `token` (in the host script's map URL), the place's owner
  and moderators. `/game/<place>/serve` (the host script,
  with the place's server ticket) needs the Orbiter's `GAMESERVER_KEY` as a
  bearer token.
  Aya.Server sends it via `--httpAccessKey`.
- Gameservers check each player's join ticket (`ClientTicket`, signed in
  `lib/server/playerTicket.ts`) before the player joins, so `player.userId`
  can be trusted in game. `host.lua` needs an Aya.Server with
  `NetworkServer:SetPlayerTicketKey`: deploy the engine before the Site (see
  Player tickets in `aya/README.md`).
- Test with temporary places and accounts, and delete them afterwards. Don't
  restart the RCC services or the Site while players are in games without
  checking first (`curl localhost:64991/` lists running gameservers).
