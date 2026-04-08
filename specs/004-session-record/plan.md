# Implementation Plan: Live Session Recording

**Branch**: `004-session-record` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)

## Summary

The current implementation is split into two layers: live session state and historical session records. `live_cash_game_session`, `live_tournament_session`, `session_event`, and `session_table_player` handle the in-progress experience, while `poker_session` powers the `/sessions` history page, filters, tags, EV metrics, and currency sync.

## Current Structure

- Database:
  - `packages/db/src/schema/session.ts` for historical sessions and links
  - `packages/db/src/schema/live-cash-game-session.ts` and `packages/db/src/schema/live-tournament-session.ts` for active play
  - `packages/db/src/schema/session-event.ts` and `packages/db/src/schema/session-table-player.ts` for live event state
  - `packages/db/src/schema/session-tag.ts` for session labels
- API:
  - `packages/api/src/routers/session.ts` for history CRUD, list filters, EV, and currency sync
  - `packages/api/src/routers/live-cash-game-session.ts` and `packages/api/src/routers/live-tournament-session.ts` for active session control
  - `packages/api/src/routers/session-event.ts` and `packages/api/src/routers/session-table-player.ts` for event and seat management
- UI:
  - `apps/web/src/routes/sessions/index.tsx` for history
  - `apps/web/src/routes/active-session/index.tsx` and `apps/web/src/routes/active-session/events.tsx` for the live session flow
  - `apps/web/src/routes/live-sessions/$sessionType/$sessionId/events.tsx` for direct event inspection

## Validation

- `session.list` must stay aligned with the history card fields, filters, and summary metrics.
- Live event mutations must keep the timeline, seat state, and active-session summary synchronized.
- Currency-linked sessions must continue to create or update the read-only `currency_transaction` row through `sessionId`.

## Assumptions

- The current code is the source of truth; no new schema or route changes are implied by this documentation pass.
- `poker_session` is the canonical history table and `sessionTag` management stays in Settings.
