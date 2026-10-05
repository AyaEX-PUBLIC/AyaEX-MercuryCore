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
