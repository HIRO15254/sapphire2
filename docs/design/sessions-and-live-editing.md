# Entries and Live Editing

The current participation model is an `entry` with one or more `play_session` days. Manual entries store ended days and payments directly; live entries derive their state and event-sourced ledger lines from `play_event`. The authoritative API contracts are in [api-after-data-model-v2.md](api-after-data-model-v2.md), and projection and undo rules are in [data-model-v2.md](data-model-v2.md) §§13–14.

## Lifecycle and projection

`live.create` starts an entry and its first day. Events are ordered by `(occurred_at, sort_order, id)` and the projector folds them into the entry, its days, details and event-sourced ledger lines. Event mutation and projection are committed together in one D1 batch. Each payment carries its own asset; projected signed ledger quantities determine the result. Manual lines are not replaced by the live projector.

A day may end held or bagged while the entry remains open. `startNextPlay` creates the next day; tournament re-entry payments belong to its start event. `complete` settles the entry. Ended days cannot receive ordinary events. `undoEndPlay` and `undoStartNextPlay` provide constrained reversal without silently discarding dependent facts. The database permits at most one unfinished play session per user.

## Editing and ownership

Live-linked edits validate and change events, then reproject; they do not patch derived results directly. Event payloads use the current v2 schema, and ownership checks include nested assets, prices, players and hand links. `all_in` hand links must belong to the same play session. Table occupancy is folded from player events, including the user's self player for Hero.

Entries retain immutable rule-version references. Rule changes create or select versions through the entry/live rule operations rather than mutating the master or an old snapshot. Archived masters remain resolvable for historical reads. Manual updates replace the submitted complete days and payments atomically; see the API reference for precise replacement and validation semantics.

## Progress and statistics

Tournament progress is folded server-side from events, including cumulative purchase counts and later purchases. Charts consume the returned progress instead of recomputing it. Statistics include settled entries only and use ledger valuation; see [statistics.md](statistics.md). Hand count and dealer button are represented by hand rows, not a separate session counter.
