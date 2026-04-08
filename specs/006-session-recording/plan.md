# Implementation Plan: Live Session Recording

**Branch**: `006-session-recording`
**Status**: Implementation Synced

## Summary

The current implementation is already split into two live session tracks:

- `liveCashGameSession` for cash games.
- `liveTournamentSession` for tournaments.
- `sessionEvent` and `sessionTablePlayer` are shared across both tracks.
- `pokerSession` keeps compatibility with the existing sessions list and analysis views.

The user-facing entry points are:

- `/sessions` for the session list, reopen actions, and completed-session event links.
- `/active-session` for the current live session overview.
- `/active-session/events` for live-session event history.
- `/live-sessions/$sessionType/$sessionId/events` for completed-session event history.

## Current Architecture

- Backend routers live in `packages/api/src/routers`.
- Schema lives in `packages/db/src/schema`.
- The live-session UI lives in `apps/web/src/components/live-sessions` and `apps/web/src/components/live-tournament`.
- The mobile nav swaps its center action based on whether a live session exists.
- The stack sheet is the primary in-session action surface for both cash games and tournaments.

## Behavior Notes

- Cash game creation records `session_start` and the initial `chip_add`.
- Tournament creation records `session_start`; the create dialog records the initial `tournament_stack_record`.
- Completion appends the final event(s), writes `session_end`, and recalculates the linked `pokerSession`.
- Reopen is allowed only from `completed` back to `active`, and only when no other live session is active.
- Event edits and deletes on completed sessions trigger P&L recalculation.

## Scope

This documentation pass only updates `specs/006-session-recording`. No code behavior is changed by this feature doc refresh.
