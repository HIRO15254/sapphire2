# Quickstart: Live Session Recording

## Prerequisites

- Bun installed
- Dependencies installed with `bun install`
- Local dev environment running with `bun run dev`

## Current Routes

- `/sessions` - historical session list, filters, create/edit dialogs, reopen action
- `/active-session` - current live session surface
- `/active-session/events` - event timeline for the active session
- `/live-sessions/$sessionType/$sessionId/events` - direct event inspection for a specific live session
- `/settings` - session tag management

## Key Files

- `packages/db/src/schema/session.ts`
- `packages/db/src/schema/live-cash-game-session.ts`
- `packages/db/src/schema/live-tournament-session.ts`
- `packages/db/src/schema/session-event.ts`
- `packages/db/src/schema/session-table-player.ts`
- `packages/api/src/routers/session.ts`
- `packages/api/src/routers/live-cash-game-session.ts`
- `packages/api/src/routers/live-tournament-session.ts`
- `packages/api/src/routers/session-event.ts`
- `packages/api/src/routers/session-table-player.ts`
- `apps/web/src/routes/sessions/index.tsx`
- `apps/web/src/routes/active-session/index.tsx`
- `apps/web/src/routes/active-session/events.tsx`
- `apps/web/src/routes/live-sessions/$sessionType/$sessionId/events.tsx`

## Verify the Flow

1. Open `/sessions` and create a cash game or tournament record.
2. Open `/active-session` and confirm the current live session summary matches the active record.
3. Open the event timeline and add or edit events.
4. Return to `/sessions` and confirm the history card shows P&L, tags, linked entities, and any EV values.
5. Open `/settings` and confirm session tags can be listed, renamed, and deleted.
