# Tasks: Live Session Recording

**Scope**: Keep this file aligned with the current implementation, not the original post-recording plan.

## Completed Areas

- [x] Historical session records are stored in `poker_session` and surfaced in `/sessions`.
- [x] Live cash game sessions use `live_cash_game_session` with event logging, seating, and active-session UI.
- [x] Live tournament sessions use `live_tournament_session` with event logging and active-session UI.
- [x] `session_event` supports lifecycle, player, cash-game, and tournament-specific events.
- [x] `session_table_player` tracks active players and seats for live sessions.
- [x] Session tags are persisted through `session_tag` and `session_to_session_tag`.
- [x] Currency-linked sessions auto-sync a `currency_transaction` through `sessionId`.
- [x] The sessions page supports create/edit/delete, filters, EV display, linked entity summaries, and reopen.
- [x] The active-session and event routes expose the current live session timeline.

## Notes

- The original post-recording task breakdown is superseded by the live-session implementation.
- Any new work should follow the current route split: history in `/sessions`, live play in `/active-session`, and events in the live-session routes.
