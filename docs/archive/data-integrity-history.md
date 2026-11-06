> Historical snapshot. Current guidance: [data-integrity](../design/data-integrity.md).

# Data Integrity History

## D1 statement limits and atomic writes

The retired `session_blind_level` writer had ten columns and could insert at most ten rows per statement. An unchunked replacement failed after deleting the existing structure (SA2-115). The legacy chip-purchase lookup also exceeded D1's bound-parameter limit.

`tournament.updateWithLevels` once executed a DELETE followed by independent inserts; a failed insert could permanently wipe tags, chip purchases or blind levels (SA2-116). A cash-session update could also save its session fields before rejecting the rule.

## Pagination and list performance

The legacy session list ordered by `sessionOrderKey DESC, id DESC` but paginated on the random UUID alone, dropping or duplicating rows. An earlier cursor looked up the boundary from the cursor row; deleting that row made the next page empty (SA2-150).

The legacy live-session lists fetched events once per item, creating up to roughly 100 extra database round-trips per page (SA2-151). The legacy endpoints were removed in the data-model cutover.

## Stored payload validation

`initialBuyIn` once accepted decimals on create while the stored event's read schema required an integer; the resulting session could no longer be read (SA2-148).

## Ownership migration

Migration `0054_stale_redwing` rebuilt the ring-game and tournament masters with owners. It populated ownership from rooms or linked sessions, discarded unreferenced ownerless ring games, and unlinked rooms owned by another user. It staged inbound child rows and links while rebuilding under D1 foreign-key enforcement. Each table's final owner index marked its rebuild complete; a retry after failure inside a rebuild could lose writes made by the old Worker between that table's CREATE and its marker.

Migration `0060_rebuild_currency_as_asset` renamed duplicate asset names with the first free ` (n)` suffix and gated the rebuild on restored rows, links and foreign-key checks.

## Historical asset description contract

The former asset description contract specified sanitized HTML at rest (SA2-25); the current contract is plain text.
