# Research: Live Session Recording

## Decision 1: Split live state from historical records

**Decision**: Keep `live_cash_game_session` and `live_tournament_session` for in-progress play, and use `poker_session` for the completed history list.

**Why**: The current code already treats live play and historical analysis as different concerns. Live state needs fast event updates, while the history page needs stable records, filters, tags, and P&L calculations.

## Decision 2: Store live play as an event log

**Decision**: Record live updates in `session_event` and derive summaries from those events.

**Why**: The event log naturally supports stack changes, tournament results, lifecycle events, and editing of recent play without flattening everything into a single summary row.

## Decision 3: Keep session-generated currency transactions linked

**Decision**: Session-linked currency entries stay in `currency_transaction` and point back to `poker_session.sessionId`.

**Why**: This keeps the history page and currency page aligned and lets the session remain the source of truth for the generated transaction amount.

## Decision 4: Tag management is user-scoped

**Decision**: Session tags live in `session_tag`, are owned by the authenticated user, and are attached through `session_to_session_tag`.

**Why**: Tags are reusable metadata, so they should be managed independently of any single session record.

## Decision 5: Current routes are split by task

**Decision**: Use `/sessions` for history, `/active-session` for the current live session, `/active-session/events` for the active timeline, and `/live-sessions/$sessionType/$sessionId/events` for direct event inspection.

**Why**: The codebase already exposes these separate routes and the docs should match what users can actually open today.
