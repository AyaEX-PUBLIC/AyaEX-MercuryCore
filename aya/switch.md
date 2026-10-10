# AyaNX Switch client

The native Switch launcher uses `/api/switch` on this Mercury instance.
Rebuild the Site to make the endpoint available. It requires no additional
secrets, database schema, or companion Orbiter changes.

Configure the console's `sdmc:/aya/config.txt` with
`mercury_url=https://your-mercury-instance.example/`. HTTPS is required.

## API

POST JSON operations:

- `login`: `username`, `password`; returns a profile and sets the normal
  expiring session cookie. Login attempts are limited per client address.
- `logout`: invalidates that session and removes the cookie.
- `join`: numeric `id`; reuses the website's server-start and join actions,
  then returns the signed Aya join configuration. Privacy, moderation,
  rate limits and game tickets follow the existing website rules.

Authenticated GET operations use the `op` query parameter:

- `me`: signed-in profile.
- `games`: `page` (two cards per page); public games, page count, PNG
  thumbnails encoded as base64. Converted thumbnails are cached for one minute.
- `search`: `category=games|players`, `q`; up to 50 results.
- `game`: numeric `id`; details and thumbnail, with private-place access checks.
- `player`: `username`; public profile.
- `avatar`: `username`; existing body-avatar PNG or its existing placeholder.

The console stores sessions separately per HTTPS instance, never passwords.
It supplies its session to the engine for authenticated asset downloads.
Games connect through the existing `/gameserver/{placeId}` WebSocket proxy
using `aya-raknet-v5`; the server validates its ordinary short-lived join ticket.
Character editing is outside this client.

Build checks do not establish Switch compatibility. Console login, game joining,
input, sign-out and repeat launches require hardware verification.
