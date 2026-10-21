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
| 8010 | Caddy (`Caddyfile.aya`): Site, `/runtime`, `/gameserver/{placeId}` (WebSocket), `/orbiter/{placeId}` (SSE), `/streaming/ws` (WebSocket) |
| 4443 | Site (docker, host network) |
| 4444 | StreamingFrame signaling relay, in the Site process (127.0.0.1 only) |
| 8000, 2009 | SurrealDB, Economy (docker, bound to 127.0.0.1; the Economy only takes the Site's key) |
| 64990 | RCC proxy (native, `../MercuryRCC/Proxy`) |
| 64991, 64992 | Orbiter private and public APIs (native, `../MercuryRCC/Orbiter`) |
| 64989+ | Aya.Server SOAP ports, one process per hosted game plus a render process |
| 10000–34999 | Aya.Server game ports (`10000 + placeId % 25000`), reached only through the Orbiter |

## Running

```bash
aya/setup-data.sh                    # loadscripts, render scripts, signing key, stable client into data/
docker compose up -d --build         # database, economy, site, caddy
../MercuryRCC/run.sh                 # RCC proxy + Orbiter (run from a desktop session)
../MercuryRCC/stop.sh                # stop them and their Aya.Server processes
```

The proxy must run where `DISPLAY` is set: thumbnail renders create a hidden
OpenGL window. Logs are in `../MercuryRCC/logs/`.

Paths that compose expects (override with environment variables):

- `AYA_APP_DIST_DIR` (default `../aya-dev/build/wasm-app-rel/bin`): the
  unified runtime, served as the dev client channel.
- `AYA_ASSETS_HOST_DIR` (default `../aya-dev/assets`): Aya's local asset
  library (`<id>.<ext>`), served by `/asset` for IDs Mercury doesn't have,
  such as the default animations.
- `AYA_DATA_UID`/`AYA_DATA_GID` (default 1000): owner of `data/`.

The RCC proxy's `Proxy/.env` sets `RCC_EXE` (the native `Aya.Server`) and
`RCC_ARGS`. `--contentPath` points at `aya-dev/client/resources/content`,
because the native build's `bin/content` copy isn't refreshed by CMake.

## Deploying to a VPS

`deploy/deploy.sh` puts the whole stack on a Debian 13 VPS: the Site,
database, economy and Caddy (compose), the RCC proxy and Orbiter, and the
engine files they use. Settings go in `deploy/vps.env` (ignored by git; see
`deploy/vps.env.example`): the SSH destination, the domain, a Cloudflare
origin certificate and key, and an optional site-wide login.

The VPS only ever runs production releases. Work on this machine as usual;
once it's stable, make a release and deploy it:

```bash
deploy/release.sh                # make the next release (2026.10.0, 2026.10.1, 2026.11.0, ...)
deploy/release.sh 2026.10.0      # or name it
deploy/deploy.sh                 # send the newest release, rebuild, restart
deploy/deploy.sh 2026.10.0       # send that release (an older one rolls back)
deploy/deploy.sh --migrate-data  # also replace the VPS's data/ with this machine's
```

- Versions are YEAR.MONTH.N, N counting from 0 each month. The site's footer
  shows the version next to the tagline (`MERCURY_VERSION`; `dev` on this
  machine).
- A release tags the last commit of MercuryCore, MercuryRCC and aya-dev with
  its version and pushes the tags. Everything else the VPS gets is copied into
  `../mercury-releases/<version>` (`RELEASES` in `vps.env`), so later work here
  never reaches the VPS by accident: from aya-dev `Aya.Server` and its files,
  `client/resources`, the WebAssembly build (the VPS's dev channel), `assets`
  and the Switch client (`build/switch-engine-clang/Aya.Switch.nro`, for
  `/download`); this machine's `mercury.core.ts` and `.env` files; the
  gameserver image. Files an earlier release has are hard links to it, so a
  release takes only the space of what changed. `RELEASE` in it lists the
  commits, and the VPS keeps the deployed one as `/opt/mercury/RELEASE`.
- Deploying sends the release's tagged code and its copies, with the settings
  switched to the VPS's domain by `aya/set-domain.sh --no-restart`. The
  stable client channel on the VPS still changes only with `--migrate-data`
  or `aya/promote-stable.sh` there.
- The database and other `data/` aren't part of a release: rolling back
  doesn't undo changes `init.surql` made.
- On the VPS (`/opt/mercury`, run by the `mercury` user), `deploy/provision.sh`:
  - installs Docker and the libraries Aya.Server needs, all from Debian
  - sets up a firewall that lets in only SSH, HTTP and HTTPS
  - makes the domain resolve to the VPS itself
  - installs systemd services for the RCC proxy, the Orbiter and an Xvfb
    display (`:99`) for renders, so they come back after a reboot
- Caddy (`deploy/Caddyfile.vps.in`, `deploy/compose.vps.yml`) serves the
  domain over HTTPS with the origin certificate, in front of the usual `:8010`
  site. Requests from the VPS itself, its gameservers and renders, never need
  the site-wide login.
- The gameserver image is copied from the release (`docker save` when it was
  made), since building it needs a `dhi.io` login.
- With `STANDALONE_DOMAIN` set in `vps.env`, the VPS also runs the standalone
  AyaEX site (aya-dev's launcher, runtime and API) on that domain, with the
  same origin certificate and an optional login of its own
  (`STANDALONE_BASIC_AUTH_*`). It runs from `deploy/compose.standalone.yml`
  on 127.0.0.1:8005 behind Mercury's Caddy, with aya-dev's `Caddyfile`,
  `apiserver/` and `web/` from the release's aya-dev tag. Its API fetches
  Roblox assets with the VPS's own `ROBLOSECURITY` (below), never the cookie in
  aya-dev's compose file.
- `--migrate-data` stops this machine's database and economy for a few
  seconds, for a consistent copy. Either way, the deploy stops if games are
  running on the VPS (`--force` to go ahead).
- `deploy/wireguard.sh` sets up a WireGuard server on the VPS (UDP 51820), so
  this machine can browse from the VPS's own IPv4 and IPv6 addresses. Use it to
  sign in to the Roblox account whose cookie the VPS fetches assets with: Roblox
  ties a login to where it was made. It writes the client config to
  `deploy/wg-mercury.conf` (ignored by git; the private key never leaves this
  machine). Import it with
  `nmcli connection import type wireguard file deploy/wg-mercury.conf`, then
  `nmcli connection up wg-mercury` / `down wg-mercury`. While it's up, all of
  this machine's traffic goes through the VPS.
- There's no Aya API on the VPS: its Site fetches assets from Roblox itself,
  with the `ROBLOSECURITY` in `/etc/mercury/site.env` on the VPS (root and the
  `mercury` group only). That file holds the VPS's own Site settings, which
  `deploy/compose.vps.yml` adds to `Site/.env`'s and `deploy.sh` never sends
  or replaces. Never copy the cookie to this machine's `Site/.env` or anywhere
  else: Roblox ends a login used from somewhere other than where it was made.
  After changing the file, run `docker compose -f compose.yml -f
  deploy/compose.vps.yml up -d site` in `/opt/mercury/MercuryCore`. The Site
  logs "Roblox refused ROBLOSECURITY" once the login has ended.

## Client channels

Players choose a client channel in **Settings → Client**: `stable` (the
default) or `dev`. Any user can switch; it's stored on the user
(`clientChannel`) and mirrored by the Site into the `ayaClientChannel` cookie
(`Site/src/hooks.server.ts`). Caddy serves `/runtime` from that channel's
directory, so the URLs are the same for both. Only signed-in players get it:
Caddy asks the Site (`/runtime-access`) before serving each file:

| Channel | Served from | Updates |
| --- | --- | --- |
| `dev` | `AYA_APP_DIST_DIR`, the live aya-dev build output | on every build; missing or broken while a build compiles and links |
| `stable` | `data/runtime/stable` → `releases/<runtime version>` | only when promoted |

After a dev build has been tested, promote it:

```bash
aya/promote-stable.sh                # snapshot the dev build as stable
aya/promote-stable.sh --list         # kept releases (* = stable)
aya/promote-stable.sh --use VERSION  # roll stable back to a kept release
```

Promoting refuses while `build_app_wasm.sh` is running or if the build output
is incomplete, copies the files Caddy serves into a new release directory, and
then switches the `stable` symlink atomically, so stable players never load a
half-copied build. Releases are named by runtime version, which doesn't cover
the page shell (`Aya.App.html`): a build that changes only the shell becomes
`<runtime version>-<shell hash>`. The three newest releases are kept (`KEEP=n`
to change).
The runtime caches by build version, so switching channels is safe.

Gameservers are native `Aya.Server` builds and aren't channelled; a client
on either channel joins the same servers.

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

## Studio

The WebAssembly Studio runs at `/runtime?apptype=studio`, on the same channels
as the Player. Its Start page is `welcome.html` (with `aya-studio.png`), which
ships with the runtime build.

Its Play button starts a playtest with `/Game/Visit.ashx`
(`data/server/loadscripts/visit.lua`, served by `/game/visit`). The Site gives
the local player the signed-in user's UserId and avatar (scripts can't rename
it, so it plays as "Player"). Aya only runs scripts loaded this way behind an
`--ayasig%` header (`SignAyaScript` in `Site/src/lib/server/sign.ts`); native
Roblox clients still get `--rbxsig%`.

Studio works with the user's games (aya-dev `client/studio/MercuryStudio.cpp`
and `client/app/MercuryStudio.js`). Before the engine starts, the shell asks
`/studio/api/session`; a reply turns on Mercury's parts of Studio, and the
standalone site's Studio stays as it was. Open it from Create > Open Studio,
or from a place page's hammer button (`/runtime?apptype=studio&placeId=…`,
which opens that game).

- The Start page and File > Open from Mercury list the user's games and open
  them from `/game/{id}` (a game without a place file opens an empty place).
- File > Publish to Mercury (also on the Home tab) uploads the place to the
  game it came from; Publish to Mercury As makes a new game (within the same
  two-game limit as the site) or publishes over another one.
- Game Settings (File menu and Home tab) changes the name, description,
  server size, avatar type and privacy. Icons, thumbnails and the store stay
  on the place's settings page.
- Playtests use the game's place id and the user's Mercury avatar; the
  standalone build's Aya Web Util dock is hidden.

The routes are in `Site/src/routes/(rbxclient)/studio/api` (`session`,
`places`, `places/{id}`, `places/{id}/file`). They use the session, refuse
requests that browsers mark as coming from another site, and only let a
game's owner (or a moderator) change it. Place changes they share with the
site's forms are in `Site/src/lib/server/places.ts`.

## Avatar types

A place's avatar type (Settings > Avatar, or Studio's Game Settings) is R6
(the default for new places), R15 or Both. With Both, each player spawns with the avatar type they chose on
the Character page (`user.avatarRig`), which their avatar picture uses too.
The Site puts the result in the CharacterAppearance URL as `ayaRig=R6|R15`
(join configuration, Studio's visit script and avatar renders, through
`_AVATAR_RIG` in `renderAvatar.lua`), and Aya picks the character from it
(`Site/src/lib/rigTypes.ts`). The R15 body's meshes (the 14 assets
7430070991–7430071119 that Aya's `characterR15.rbxm` uses) are in
`aya-dev/assets` as `<id>.mesh`, so a site without an asset fallback (the
VPS) still serves them; without them R15 limbs are invisible. Players get the rig when
they join, so changing it doesn't restart a running server.

## Notes

- Aya.Server runs with `--insecure`, which turns off the engine's client
  checks (protocol, security key, hash) the browser Player can't pass. Player
  identity is still checked: see [Player tickets](#player-tickets). A public
  deployment needs HTTPS: set `ORIGIN`, `Domain` and the Caddy site address
  together.
- Places must be uploaded (place settings) or copied to `data/places/{id}`
  before Play can start a server.
- Assets Mercury doesn't have come from Aya's local library, then the Aya API
  (`AYA_ASSET_FALLBACK_URL`), Roblox itself (a `ROBLOSECURITY` cookie in the
  Site's environment) or Open Cloud, which use the operator's Roblox
  credentials. Those are cached in `data/assetcache`, up to `ASSET_CACHE_MAX_MB`
  (2 GiB by default; the oldest files go first). Each user, and each gameserver
  by the place it hosts, may fetch 1000 new assets at once and then 2 a second;
  the whole site 5000 and then 10 a second. Ids no upstream has are remembered
  for 10 minutes.
- Place files are only served to the gameserver hosting the place (`ASSET_KEY`
  plus the `token` in its map URL), the place's owner and moderators. The host
  script from `/game/{id}/serve` carries the place's server ticket and that
  token, so only the Orbiter gets it (`GAMESERVER_KEY`, the same in
  `Site/.env` and `../MercuryRCC/Orbiter/.env`).

## Place owners

The place's owner is its creator in game: the join script's `CreatorId` and
the gameserver's `game:SetCreatorID` (host script, `_CREATOR_ID`) are the
owner's engine UserId. Scripts see it as `game.CreatorId`, and the 2015 and
2016 player lists show the place owner icon next to them.

The owner also gets the server side of the developer console: the server log,
server stats and the server command line. The console asks the website which
tabs to show (`/users/{id}/canmanage/{placeId}`, true only for the owner
asking with their own session, so never for a gameserver). That only decides
what the client shows. The website can't vouch for a connection, so
Aya.Server doesn't ask it on insecure servers: the host script calls
`LogService:AllowConsoleAccess(player)` for the owner once their join ticket
is verified.

## Player tickets

Gameservers check who each player is before the Player joins `Players`, so
place scripts (admin scripts keyed on `game.CreatorId`, DataStores, badges)
can trust `player.userId`, and nobody can join as someone else:

- `/game/join/aya` puts a `ClientTicket` in the join config:
  `timestamp;fullSignature;userSignature`, HMAC-SHA256 signatures of the
  player's UserId, name, `CharacterAppearance` URL and the time
  (`Site/src/lib/server/playerTicket.ts`).
- The key is derived from `GAMESERVER_KEY` and the place's server ticket, and
  the host script hands it to the engine with
  `NetworkServer:SetPlayerTicketKey` (`_PLAYER_TICKET_KEY`) before it starts
  the network server.
- Aya.Server then checks the ticket even under `--insecure`: the UserId when
  the client connects, everything else before the Player joins. A ticket works
  once, within five minutes. A bad, reused or missing ticket disconnects the
  client, and the server log says why ("Rejected join ticket ...").
- The host script's `/game/verifyticket` check still runs after that: it
  spends the website's join ticket and marks the player as playing.

The key call isn't in a pcall, so an Aya.Server without
`SetPlayerTicketKey` (aya-dev before 2026-10-19) fails to host instead of
hosting without checks. Deploy the engine before the Site. Only Mercury sets a
key: Aya's own launcher hosts without one and keeps trusting the client.

## In-game reports

The in-game menu's Report tab (and the report menus of the 2013 to 2015
versions) sends reports to the gameserver. The gameserver adds the chat the
reporter could see and posts them to `/game/abusereport`
(`Players:SetAbuseReportUrl` in the host script, with the server key). They
show up in **Admin → Abuse reports** like website reports: about the reported
player, or about the place's owner for a report on the game. The in-game
reason is mapped to the website's categories, and the chat log goes in the
note. A player must be in the game to report in it, and can send 5 reports
every 10 minutes (website reports included). The 2010 and 2011 versions'
report buttons don't do anything.

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

The Economy refuses any request without `Authorization: Bearer <key>`, so
nothing else that can reach its port can move currency. The Site makes the key
on first use in `data/economy/key` (mode 0600). To change it, delete the file
and restart the Site, which makes a new one. The Economy reads the file on every
request, so the old key stops working at once and it needs no restart.
The ledger (`data/economy/ledger`) is mode 0600 as well.

## News

Administrators (permission level 5) write news posts at Admin > News: Markdown
with a live preview, an optional cover image (cropped to 16:9 and kept as
`data/news/<id>.avif`), and a draft state or a publish date to schedule a post.
Readers see them at `/news` (newest first, with the latest as the lead story),
at `/news/<id>/<title>`, and as the three latest headlines on the home page.
Drafts and scheduled posts are visible only to administrators. Posts are in
the `news` table, and every change is in the audit log.

The Markdown is parsed by `Site/src/lib/markdown.ts` into a tree that
`components/Markdown.svelte` draws as elements, so a post can't carry HTML or
script: HTML is shown as text, links may only be web, mail or site addresses,
and images https or site paths. Run its tests with `bun test
src/lib/markdown.test.ts` in `Site/`. The masthead font is UnifrakturCook (SIL
OFL, in `Site/static/fonts`).

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
every 5 seconds; it needs the `accesskey` header, and the place's server ticket
says which place) lists who is connected. Only players who joined through the website count. Each account has
one timer (`user.playRewardAt`), so being in two servers doesn't double it. Out
of game for more than a minute restarts the timer. The amount and interval are
at the top of `Site/src/lib/server/playtime.ts`.

## StreamingFrames

Remote StreamingFrames work. The player whose UserId is the frame's
`ControlingUserID` shares a screen or tab from their browser, and everyone in
the game sees it on the frame. The video goes peer to peer over WebRTC; the
Site only passes on the signaling:

- Before joining, the Player posts its join script URL to `/streaming/token`.
  The Site answers with the relay's address, the ICE servers and the engine
  UserId the player plays as. It refuses players who haven't pressed Play for
  that place.
- The relay (`Site/src/lib/server/streaming.ts`) is a Bun WebSocket server in
  the Site process, on `STREAMING_PORT` (4444, set in `compose.yml`) on
  127.0.0.1. Caddy proxies `/streaming/ws` to it. A socket needs the session
  cookie, the Site's origin and a recent `playing` record for the place, which
  is checked again every minute. The relay stamps each message with its sender,
  and the Player only shows a frame's stream from its `ControlingUserID`.
- `ControlingUserID` takes the engine UserId (`Player.UserId` in game), which
  Mercury derives from the username (`Site/src/lib/server/engineUser.ts`), not
  the Mercury user id. Every profile shows it as "User ID".
- Players in a game can see the streamer's IP address in the WebRTC
  connection, and the streamer theirs. To hide it, run a TURN server and set
  `STREAMING_ICE_SERVERS` (a JSON array of RTCIceServer) and
  `STREAMING_ICE_POLICY=relay` in `Site/.env`. Without them, the Player uses
  Google's public STUN server.
- Server StreamingFrames (a browser run by the gameserver) stay off: the
  gameservers are never started with `--allow-server-streamingframes`.
