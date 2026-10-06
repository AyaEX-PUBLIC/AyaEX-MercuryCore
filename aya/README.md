# Mercury Core with Aya

This branch runs Mercury Core with Aya as its client stack:

- **Player**: the unified Aya WebAssembly app, opened in the browser at
  `/runtime?apptype=player&joinScriptUrl=/game/join/aya?ticket=…` when a user
  presses Play.
- **Gameservers and thumbnails**: native Linux `Aya.Server` processes, driven
  over RCC SOAP by the Orbiter and RCC proxy from `../MercuryRCC` (branch `aya`).

Everything is served from `http://localhost:8010`. localhost is a secure
context, so the multithreaded Player works over plain HTTP.

## Layout

| Port | Service |
| --- | --- |
| 8010 | Caddy (`Caddyfile.aya`): Site, `/runtime`, `/gameserver/{placeId}` (WebSocket), `/orbiter/{placeId}` (SSE) |
| 4443 | Site (docker, host network) |
| 8000, 2009 | SurrealDB, Economy (docker, bound to 127.0.0.1) |
| 64990 | RCC proxy (native, `../MercuryRCC/Proxy`) |
| 64991, 64992 | Orbiter private and public APIs (native, `../MercuryRCC/Orbiter`) |
| 64989+ | Aya.Server SOAP ports, one process per hosted game plus a render process |
| 10000–34999 | Aya.Server game ports (`10000 + placeId % 25000`), reached only through the Orbiter |

## Running

```bash
aya/setup-data.sh                    # loadscripts, render scripts, signing key into data/
docker compose up -d --build         # database, economy, site, caddy
../MercuryRCC/run.sh                 # RCC proxy + Orbiter (run from a desktop session)
../MercuryRCC/stop.sh                # stop them and their Aya.Server processes
```

The proxy must run where `DISPLAY` is set: thumbnail renders create a hidden
OpenGL window. Logs are in `../MercuryRCC/logs/`.

Paths that compose expects (override with environment variables):

- `AYA_APP_DIST_DIR` (default `../aya-dev/build/wasm-app-rel/bin`): the
  unified runtime.
- `AYA_ASSETS_HOST_DIR` (default `../aya-dev/assets`): Aya's local asset
  library (`<id>.<ext>`), served by `/asset` for IDs Mercury doesn't have,
  such as the default animations.
- `AYA_DATA_UID`/`AYA_DATA_GID` (default 1000): owner of `data/`.

The RCC proxy's `Proxy/.env` sets `RCC_EXE` (the native `Aya.Server`) and
`RCC_ARGS`. `--contentPath` points at `aya-dev/client/resources/content`,
because the native build's `bin/content` copy isn't refreshed by CMake.

## Hosting flow

1. Play posts `?/join` (ticket) and `?/start`. The Site asks the Orbiter to
   start the place.
2. The Orbiter fetches `/game/{id}/serve` (`data/server/loadscripts/host.lua`),
   fills in its status URL and sends it to the RCC proxy. The proxy runs it as
   an OpenJobEx job on its own Aya.Server (`--websocket`).
3. The host script starts the network server, loads `/asset/?id={placeId}`
   (the uploaded place file in `data/places/`) and reports `Ready`. The Orbiter
   then reports the place as ready over SSE.
4. The page opens the Player with `/game/join/aya`, whose `MachineAddress` is
   `ws://localhost:8010/gameserver/{placeId}`. The Orbiter proxies that socket
   to the game port only while the gameserver is running.
5. Gameservers send heartbeats and close themselves after five minutes without
   players.

## Notes

- Aya.Server runs with `--insecure` (no engine ticket checks). That is fine
  locally. A public deployment needs Aya-compatible engine tickets and HTTPS:
  set `ORIGIN`, `Domain` and the Caddy site address together.
- Places must be uploaded (place settings) or copied to `data/places/{id}`
  before Play can start a server.

## Game passes, developer products and badges

Created per place in **place settings → Store** (logic in
`Site/src/lib/server/store.ts`):

- **Game passes** (asset type 34): bought once on the place page or in game
  (`MarketplaceService:PromptGamePassPurchase`), checked with
  `GamePassService:PlayerHasPass` / `MarketplaceService:PlayerOwnsAsset`. The
  place owner owns all of the place's passes.
- **Developer products** (`devProduct`): bought any number of times in game
  (`PromptProductPurchase`). Each purchase leaves a `productReceipt` that the
  gameserver hands to `MarketplaceService.ProcessReceipt` and then marks
  complete.
- **Badges** (asset type 21): awarded by the place's own gameserver
  (`BadgeService:AwardBadge`), shown on the place page and user profiles.

Purchases are paid in Mercury currency to the place owner and are tied to the
buyer's session (the purchase prompt runs in their browser). A developer
product purchase retried with the same request ID is charged once. Badge awards,
receipts and the pending-receipt list require the server key (`ASSET_KEY`).
Caddy relabels the receipt-completion POST so SvelteKit's cross-site form check
doesn't reject it.

Aya.Server's `--baseUrl` must be the site's public origin with a trailing slash
(e.g. `https://mercury.nodium.lol/`); the engine derives its marketplace API URL
from it. `set-domain.sh` keeps it current.

## Casino

`/casino` (link in the top bar) has slots, mines, crash and horse plinko,
played with the site currency. Logged-in users only.

- Every outcome is decided on the server (`Site/src/lib/server/casino.ts`)
  with a cryptographic RNG. The pages under `routes/(main)/casino` only animate
  results. Mine positions and crash points stay in the `casinoRound` table
  until the round ends.
- Each game returns about 93% of bets over time (`RTP` in
  `Site/src/lib/casinoMath.ts`, shared by the server and the pages). Slots
  return 0.932, plinko 0.930 at every risk level, mines 0.92–0.93 for any
  strategy, and crash 0.93 for any cash-out target.
- Bets are whole amounts from 1 to 10,000. A bet is burned and a win is minted
  through the Economy service, so both show in `/economy` with a
  `Casino: <game>` note. One action at a time per player, so double clicks
  can't double spend.
- Big wins (10×, 50× and 200× and up) get a full-screen celebration. Sounds are
  synthesised in the browser and can be muted from the casino header.

## Managing currency (administrators)

**Admin → Economy → User balances** (`/admin/balances`) lists every user's
balance. **Manage** opens a user's page, where an administrator can:

- **Change the balance:** add, remove or set an exact amount, with a reason.
  The change is a mint or burn in the Economy service. It shows in the user's
  transaction history and in the audit log (action "Economy").
- **Review purchases:** every item they own, with when they got it and what
  they paid (matched from the ledger, so free items appear too). Also their
  developer product purchases (granted or pending) and up to 2000 currency
  transactions, which can be filtered into purchases, sales, casino and
  stipends/adjustments.

The Economy service serves `GET /balances` and accepts `?limit=` (up to 5000)
on `/transactions`. A user's history is now the last N of *their*
transactions; before, it was their share of the last 100 site-wide.

## Friends and follows in game

In-game friends and follows use the website's friends, requests and follows,
through `Site/src/lib/server/social.ts` and the routes under `game/social/`:

- **Friends:** the host script points the gameserver's `FriendService` at
  `/game/social/friends/*` (server key). Friend requests, accepts and unfriends
  made in game are saved on the site, with the same notifications as the
  profile buttons. When a player joins, the gameserver loads which players in
  the server are already their friends (or have pending requests), so the
  player list shows them. `Player:IsFriendsWith` falls back to
  `/Game/LuaWebService/HandleSocialRequest.ashx` for players who aren't in the
  server.
- **Follows:** the Player's dropdown calls `user/follow`, `user/unfollow`,
  `user/following-exists` and `user/get-friendship-count` with the player's
  session, and the gameserver calls `user/multi-following-exists`.
  `Caddyfile.aya` sends those to `game/social/*`. `/user/follow` and
  `/user/unfollow` are only rerouted for POSTs with no query string, so the
  profile pages of users with those names, and their form actions, still work.

These URLs are set when a gameserver starts, so servers that were already
running pick them up only after they restart. `Caddyfile.aya` is mounted as a
single file: after editing it, recreate the container
(`docker compose up -d --force-recreate caddy`), because a reload still reads
the old copy.

## Groups

Groups are enabled (`Pages` in `mercury.core.ts`), and only administrators
can create them. A group's owner, or any site administrator, manages it from
the group page:

- **Who can join:** open, invite only, or closed (nobody new can join).
- **Invites:** invite by username. The user is notified and can accept or
  decline on the group page. Invites can be revoked.
- **Members:** remove anyone except the owner, who can't leave their own group.

**In game**, every group has a numeric ID, shown on its page (`player:IsInGroup(id)`).
It's the group's `engineId` if set, or otherwise a hash of its record ID
(`Site/src/lib/server/groups.ts`). `Player:IsInGroup`, `GetRankInGroup`
(255 owner, 1 member, 0 otherwise) and `GetRoleInGroup` are answered by
`/Game/LuaWebService/HandleSocialRequest.ashx`.

The invite-only **Administrators** group (owned by Mollomm1) has `engineId`
1200769. Aya's 2016 CoreScripts (`client/resources/content/scripts/Modules/
TwentySixteen/PlayerlistModule.lua` and `Chat.lua` in aya-dev) give members of
that group the admin icon in the player list and the admin chat style. Those
scripts are packed into `Aya.App.data`, so changing them needs a wasm relink.

## Playtime rewards

Players earn 5 currency for every 5 minutes in game ("Playtime reward" in their
economy history). The gameserver's presence ping (`/game/serverpresence`, about
every 5 seconds, authorised by the place's server ticket) lists who is
connected. Only players who joined through the website count. Each account has
one timer (`user.playRewardAt`), so being in two servers doesn't double it. Out
of game for more than a minute restarts the timer. The amount and interval are
at the top of `Site/src/lib/server/playtime.ts`.
