# Research: Live Session Recording

**Branch**: `006-session-recording`

## R-001: Separate live session tables

Cash game and tournament sessions are modeled separately as `liveCashGameSession` and `liveTournamentSession`. That keeps the schemas small and matches the way the UI and routers already diverge.

## R-002: Shared event and table-player tables

`sessionEvent` and `sessionTablePlayer` are shared across both live session types, with nullable foreign keys to either live session table. The routers validate that exactly one session id is present.

## R-003: JSON payloads with Zod validation

Event payloads are stored as JSON text and validated in the API layer. This matches the current `session-event` router and keeps the event model flexible while staying type-safe.

## R-004: Live session lifecycle

The implementation uses only `active` and `completed` statuses. Reopen moves a completed session back to active, appends a new `session_start`, and clears the derived `pokerSession` / `currencyTransaction` so the next completion recalculates them.

## R-005: Current UI flow

The session creation dialog is the entry point for both live session types, while `/active-session` and the stack sheet are the primary in-session surfaces. Completed sessions stay reviewable from `/sessions` and the event-history route.

## R-006: Compatibility with existing reporting

`pokerSession` remains the reporting layer for the older session list and analysis flows. Live sessions attach to it on completion so the rest of the app keeps working without a separate reporting path.
