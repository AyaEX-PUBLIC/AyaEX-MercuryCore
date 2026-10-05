# Discord invite bot

Hands out Mercury registration keys from Discord with a `/invite` command.

- `/invite` only works in one channel (`DISCORD_CHANNEL_ID`), for members with
  one role (`DISCORD_ROLE_ID`). Everything else gets a private explanation.
- Each Discord account gets one key, linked to it (`discordId` and
  `discordName` on the `regKey` record). Running `/invite` again shows the same
  key, or the account it already created. Replies are only visible to the
  person who ran the command.
- Keys work `KEY_USES` times (default 1). They're created by the `InviteBot`
  account and appear under Admin → Registration keys with the Discord user and
  the Mercury account that used them.
- The key prefix and site name are read from `mercury.core.ts`.
- `/getuser discord:@member` or `/getuser username:name` (server administrators
  only; hidden from everyone else): shows the linked Mercury account and
  Discord account, the key, role, registration and last-online times, and any
  active moderation. The reply is only visible to you.

- `/autoadd role required_role min_days min_messages [dry_run]` (server
  administrators only): gives `role` to every member who joined at least
  `min_days` ago, has `required_role` and has sent at least `min_messages`
  messages. Use `dry_run:True` first to see who would get it. The bot needs
  **Manage Roles**, and its own role must be above `role` in Server Settings →
  Roles.

Message counts: Discord doesn't tell bots how many messages someone sent, so
the bot counts them itself. On startup it catches up every channel it can read
(and active threads), then scans their history once (resumable across
restarts), and counts new messages live. Messages from bots, webhooks and
system messages aren't counted, nor are archived threads or channels it can't
read. `/getuser discord:@member` shows a member's count.

New registrations are logged by the Site to the `Logging.DiscordModerationWebhook`
webhook, with the account, the Discord user its key belonged to, and the key.

## Setup

1. In the [Discord developer portal](https://discord.com/developers/applications),
   create an application, open **Bot** and copy its token. No privileged
   intents are needed.
2. Invite it to your server, replacing `APP_ID` with the application ID:
   `https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot%20applications.commands&permissions=0`
3. In Discord, turn on Developer Mode (Settings → Advanced). Then right-click
   the server, the claim channel and the role to copy their IDs.
4. Fill in `DiscordBot/.env` (copied from `.env.example`): the token, the three
   IDs and `SITE_URL`.
5. Start it from the `MercuryCore` directory:

   ```bash
   docker compose --profile discord up -d --build discordbot
   docker compose logs -f discordbot
   ```

   The log should show `Logged in as ...; /invite registered in guild ...`.

The bot only runs with the `discord` profile, so a plain `docker compose up`
doesn't start it.

To revoke an unused key, use **Disable key** on the Registration keys admin
page; `/invite` then tells that person to contact staff, and doesn't issue
another. To give someone a new key anyway, create one on that page and send it
to them.
