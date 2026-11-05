# MCP Server

> **[日本語版はこちら](mcp.ja.md)**

sapphire2 exposes a remote [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server so AI agents — claude.ai connectors, Claude Desktop, Claude Code, or any MCP-capable client — can read poker statistics and manage rooms and game masters.

- **Endpoint**: `https://<your-api-host>/mcp` (Streamable HTTP)
- **Auth**: OAuth 2.1 with dynamic client registration (RFC 7591), PKCE required
- **Implementation**: `packages/mcp`, mounted by the Worker in `apps/server`

## Connecting

### claude.ai / Claude Desktop

Add a custom connector and paste the endpoint URL:

```
https://<your-api-host>/mcp
```

The client discovers the OAuth endpoints via `/.well-known/oauth-protected-resource`, registers itself, and opens the login/consent flow in your browser. Sign in with your sapphire2 account, press **Approve**, and the connector is live.

### Claude Code

```sh
claude mcp add --transport http sapphire2 https://<your-api-host>/mcp
```

Claude Code runs the same OAuth flow on first use (`/mcp` → authenticate).

## OAuth flow

1. Client `POST /api/auth/mcp/register` (dynamic client registration — no pre-shared secrets).
2. Client opens `GET /api/auth/mcp/authorize?...` in the browser.
3. Not signed in? better-auth stores the request and redirects to the web app's `/login`; after sign-in the app returns the browser to the authorize endpoint.
4. The Worker renders the consent page (app name, redirect hosts and actual tool capabilities). **Approve** posts to `/api/auth/oauth2/consent` and redirects back to the client with an authorization code.
5. Client exchanges the code at `POST /api/auth/mcp/token` (PKCE-verified) and calls `/mcp` with `Authorization: Bearer <access_token>`.

Discovery documents are served at the root, per RFC 8414 / RFC 9728:

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource` (also at `/.well-known/oauth-protected-resource/mcp`)

Unauthenticated `/mcp` requests receive `401` with `WWW-Authenticate: Bearer resource_metadata="…"` so clients can bootstrap discovery.

## Tools

The tool surface is a **projection of the tRPC `appRouter`**: each tool's input schema is the exact Zod schema the API validates with (a tool for one branch of a union input uses that branch's schema), and each response is the same JSON the HTTP API returns. Timestamp inputs are unix seconds and outputs follow the router's JSON serialization; **date-only values are `YYYY-MM-DD` strings**, and **amounts are plain integers** in the asset's smallest unit.

The statistics tools count **settled entries only** and take exactly one mode: `assetId` (that asset's real lines, unconverted; entries that also used other assets are reported in `multiAssetEntryCount` / `otherAssetIds`), `valuation: "real" | "virtual"` with an optional `baseAssetId` (defaults to the base in user settings; with neither the call fails with `PRECONDITION_FAILED`; an entry with an unrated line is excluded and reported in `excludedEntryCount` / `missingRates`), or `normalized: true` (cash in big blinds and tournaments in buy-ins, never summed). `dateFrom` / `dateTo` are inclusive and compare with the entry's `playedOn`; `entryTagIds` / `tournamentTagIds` filter by tag.

The B06 cutover removed the old completed-session and live-session APIs and their MCP tools. Finished entries are recorded and edited with the `entry_*` tools. Live recording (`live.*`, `playEvent.*`, `tablePlayer.*`) is intended for the new UI's cockpit (SA2-390 / U01 onward) and is deliberately not exposed: it is timestamped as play happens, and a retried call appends a duplicate event. That includes the multi-day operations — ending a day (`live.endPlay`), starting the next day or a re-entry (`live.startNextPlay`) and their undos (`live.undoEndPlay`, `live.undoStartNextPlay`): a retried start adds another day.

| Tool | tRPC procedure | Kind |
|---|---|---|
| `stats_summary` | `stats.summary` | read |
| `stats_breakdown` | `stats.breakdown` | read |
| `stats_profit_loss_series` | `stats.profitLossSeries` | read |
| `room_list` | `room.list` | read |
| `asset_list` | `asset.list` | read |
| `asset_rate_list` | `assetRate.list` | read |
| `user_setting_get` | `userSetting.get` | read |
| `player_list` | `player.list` | read |
| `hand_list` | `hand.list` | read |
| `hand_get_by_id` | `hand.getById` | read |
| `entry_list` | `entry.list` | read |
| `entry_get_by_id` | `entry.getById` | read |
| `entry_create_cash` | `entry.create` (`kind: "cash"`) | write |
| `entry_create_tournament` | `entry.create` (`kind: "tournament"`) | write |
| `entry_update` | `entry.update` | write |
| `entry_tag_list` | `entryTag.list` | read |
| `entry_tag_create` | `entryTag.create` | write |
| `tournament_tag_list` | `tournamentTag.list` | read |
| `tournament_tag_create` | `tournamentTag.create` | write |
| `hand_tag_list` | `handTag.list` | read |
| `hand_tag_create` | `handTag.create` | write |
| `player_tag_list` | `playerTag.list` | read |
| `player_tag_create` | `playerTag.create` | write |
| `ring_game_list_by_room` | `ringGame.listByRoom` | read |
| `tournament_list_by_room` | `tournament.listByRoom` | read |
| `room_get_by_id` | `room.getById` | read |
| `room_create` | `room.create` | write |
| `room_update` | `room.update` | write |
| `room_archive` | `room.archive` | write |
| `room_restore` | `room.restore` | write |
| `ring_game_create` | `ringGame.create` | write |
| `ring_game_update` | `ringGame.update` | write |
| `ring_game_archive` | `ringGame.archive` | write |
| `ring_game_restore` | `ringGame.restore` | write |
| `tournament_get_by_id` | `tournament.getById` | read |
| `tournament_create_with_levels` | `tournament.createWithLevels` | write |
| `tournament_update_with_levels` | `tournament.updateWithLevels` | write |
| `tournament_archive` | `tournament.archive` | write |
| `tournament_restore` | `tournament.restore` | write |
| `game_group_list` | `gameGroup.list` | read |
| `game_group_create` | `gameGroup.create` | write |
| `game_group_update` | `gameGroup.update` | write |
| `game_group_archive` | `gameGroup.archive` | write |
| `game_group_restore` | `gameGroup.restore` | write |
| `game_variant_list` | `gameVariant.list` | read |
| `game_variant_create` | `gameVariant.create` | write |
| `game_variant_update` | `gameVariant.update` | write |
| `game_variant_archive` | `gameVariant.archive` | write |
| `game_variant_restore` | `gameVariant.restore` | write |
| `game_mix_list` | `gameMix.list` | read |
| `game_mix_create` | `gameMix.create` | write |
| `game_mix_update` | `gameMix.update` | write |
| `game_mix_archive` | `gameMix.archive` | write |
| `game_mix_restore` | `gameMix.restore` | write |

`player_list` excludes the user's own self (Hero) player and temporary players. `player.getSelf` is not exposed, and neither are an opponent's hand history and VPIP/PFR (`player.hands`, `player.handStats`), which belong to the player screens.

`stats_summary` and `stats_breakdown` report `handCount` (hands at every detail level), `bb100` and `handsPerHour`. `bb100` is 100 × the summed bb results ÷ the summed hands over cash entries with a big blind and at least one hand — one pooled ratio, never an average of per-entry rates. `handsPerHour` counts only days with at least one hand and both a start and an end, so its hands and hours come from the same days. Both are `null` when nothing qualifies.

Master-data updates are annotated destructive. **Deletion is deliberately not exposed.** Rooms, ring games, tournaments and game masters have archive/restore tools instead. Game-master lists exclude archived rows by default; `includeArchived` includes them.

`ring_game_create` takes a `rule` with an optional `game` selected by `{variantId}`, `{gameMixId}`, or `{lineupId}`. Find active variant and mix IDs with `game_variant_list` and `game_mix_list`; reuse a `lineupId` from `ring_game_list_by_room` to retain its saved composition, including archived selections. Newly selecting archived masters is not allowed. If omitted on creation, the game defaults to builtin NLH. A mix groups variants by game group in order of first appearance. When supplied, `stakes` must contain one entry per resulting lineup group in order, each naming `gameGroupId` and optionally its blinds and ante. Omitted stakes carry forward by group ID and occurrence within that structure, not absolute position.

`ring_game_list_by_room` returns each master's `currentRuleId`, `ruleVersion` (including `lineupId` and `stakes`), and `lineups` keyed by ID. `ring_game_update` merges supplied `rule` fields into the current rule; a changed rule creates an immutable version and unchanged content reuses the existing version. The API's `ringGame.restoreRule` is screen-only Undo and is not exposed through MCP; `ringGame.delete` is excluded as destructive. Archive a referenced master instead.

`tournament_update_with_levels` and `game_mix_update` REPLACE their child lists — read the entity first and send the full list back. A tournament's `rule` is an immutable version: `game` is one of `{ variantId }`, `{ gameMixId }` or `{ lineupId }`; each level's `stakes` list one entry per group of its game in lineup order (`anteType` none / all / bb); `prices` are `{ kind: entry | reentry | addon, assetId, amount, fee, chips, label? }`; at most 100 levels and 20 prices. Saving unchanged content creates no version; any change creates a new one and keeps the old. Restoring an earlier version (`tournament.restoreRule`) stays on the tournament screen.

`tournament_create_with_levels` and `tournament_update_with_levels` accept `tagIds`, not tag names. On update, supplying `tagIds` replaces the full tag list; omit it to leave tags unchanged, or send `[]` to clear them.

Game groups carry `blind1Required`–`blind3Required` next to their blind labels. The built-in Limit and Stud groups require Small Bet and Big Bet (Stud's Bring-in stays optional), and Big Bet requires SB and BB and has no third field. `game_group_create` defaults every flag to false, and only a labeled field can be required. Every newly written ring-game or tournament rule version, carried stakes included, must fill each required blind and leave fields without a label empty (`BAD_REQUEST`); ante is exempt and keeping an unchanged version is not rechecked. `game_group_update` rejects clearing a label while a saved stake still has a value in that field (`CONFLICT`).

`hand_list` pages one play session's hands from the highest `handNo` (1–50 per page, default 20) and returns `{ items, nextCursor }`; send `nextCursor` back as `cursor`, which works only with the `playSessionId` it came from. A play session's hand count is the number of its hands at every detail level, and its current button is the `buttonSeat` of its highest hand. `detail` is `count` (no boards, seats, pot, rake or memo), `summary` (a note taken at the table: Hero's single seat, boards, pot, rake and memo, never actions) or `full` (every seat and the actions, which `hand_get_by_id` returns). Summary values are notes, not statistics input. `isHero` marks the seat whose `playerId` is the user's own player. The hand counter writes (`hand.add`, `hand.undoLast`), the detail write `hand.update` and `hand.delete` are not exposed.

`entry_list` pages the user's entries newest `playedOn` first (1–100 per page, default 20) with optional `kind`, `status`, `roomId`, `assetId` and inclusive `dateFrom`/`dateTo` (`YYYY-MM-DD`); a `nextCursor` works only with the filters it came from. Each entry carries its days (`playSessions`), every money line (`lines`, signed quantity in the asset's smallest unit), per-asset `totals`, `valuation` in the base asset with `missingRates`, its rule version with `ruleDrift`, and tags. `entry_create_cash` and `entry_create_tournament` are the two `kind` branches of `entry.create`: `playedOn` is required and equals the first day's `localDate`; without `playSessions` one day is recorded with the top-level `payments`. Payments are `{ role, assetId, quantity, effect, priceId? }` with a positive quantity whose sign the role gives. An entry links a master by `ringGameId` / `tournamentId` or records its own `rule`. `entry_update` changes only supplied fields; `tagIds`, `playSessions` and `payments` REPLACE the whole list, a day kept by its `id` keeps its hands, and a day left out is deleted with them. A live entry accepts only `roomId`, `assetId`, `title`, `memo` and `tagIds`. The linked master and rule cannot be changed through `entry_update`: the rule operations (`entry.overrideRule`, `entry.applyMasterRule`, `entry.pushRuleToMaster`, `entry.relink`) are a screen workflow, `entry.restoreRule` is screen-only Undo, and none of them is exposed, nor is `entry.delete`. One entry holds at most 100 days, 1000 payments and 100 tags.

The `entry_tag_*`, `tournament_tag_*`, `hand_tag_*` and `player_tag_*` list/create tools manage the four kinds of tags. Renaming, deleting and reordering tags stay on the tag screen.

`asset_list` returns currencies and items with `balance`: the signed sum of every real ledger line in the asset's smallest unit (for an item, the number held), including buy-ins of entries still in play. Archived assets appear only with `includeArchived`, which returns active and archived ones together. `asset_rate_list` returns the rate history, or with `effectiveAt` the latest rate in force per base/quote direction. `user_setting_get` returns the reporting base currency and time zone (`null` time zone means Asia/Tokyo); a change to either, or to a past rate, also changes past converted figures. Asset, rate and setting writes are not exposed, and neither is the wallet ledger (`ledger.*`: an asset's history, deposits and withdrawals, exchanges) or its categories (`ledgerCategory.*`).

Procedures not listed are deliberately excluded (irreversible deletes, non-idempotent favourite toggles, the wallet ledger, AI extraction, …) — the reasons live in `packages/mcp/src/tools/registry.ts` and are enforced by the coupling test.

Authorization is the API's own: every call goes through `appRouter.createCaller` with your user session, so `protectedProcedure` and all ownership checks apply exactly as they do for the web app.

## Operational notes

- **Consent is always enforced.** The Worker rewrites every authorize request to `prompt=consent` before better-auth sees it — without this, better-auth's mcp plugin issues codes to any dynamically-registered client with zero user interaction.
- `/mcp` requires **no new environment variables or Worker secrets** — the OAuth provider derives its URLs from `BETTER_AUTH_URL` and `CORS_ORIGIN`.
- **Clients may register without a name.** `client_name` is optional in RFC 7591 and Claude's connector omits it; the Worker fills in an empty name before better-auth writes the row, so registration cannot fail on the `NOT NULL` column, and the consent page shows *Unknown application* alongside the redirect host.
- The OIDC tables (`oauth_application`, `oauth_access_token`, `oauth_consent`) ship in migration `0050`, whose statements are all `IF NOT EXISTS` so a partial apply can be replayed (see `.claude/rules/db-migrations.md`).
- Access tokens expire after 1 hour; refresh tokens after 7 days (better-auth defaults). Clients refresh automatically.
