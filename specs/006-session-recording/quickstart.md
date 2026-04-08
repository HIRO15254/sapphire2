# Quickstart: Live Session Recording

**Branch**: `006-session-recording`

## Entry Points

- `/sessions` for the session list, reopen actions, and completed-session event links.
- `/active-session` for the current live session.
- `/active-session/events` for the current live session's history.
- `/live-sessions/$sessionType/$sessionId/events` for a completed session's history.

## Cash Game Flow

1. Open `/sessions` or use the mobile center button when no live session is active.
2. Choose `Cash Game`, select a store and ring game, and enter the initial buy-in.
3. Submit the dialog.
4. The app records `session_start` and the initial `chip_add`, then navigates to `/active-session`.
5. Use the stack sheet to record `stack_record`, all-ins, and any later `chip_add` add-ons.
6. Complete the session from the stack sheet.
7. Open the completed session card's `Events` link to review or edit the history.

## Tournament Flow

1. Open `/sessions` or use the mobile center button when no live session is active.
2. Choose `Tournament`, select a store and tournament, and enter the defaults shown by the form.
3. Submit the dialog.
4. The backend records `session_start`, and the create dialog immediately writes the initial `tournament_stack_record`.
5. Use the stack sheet to add further `tournament_stack_record` entries and chip purchase details.
6. Complete the session with placement, total entries, prize money, and optional bounty prizes.
7. Review the event history from the session card or the live event route.

## Reopen Flow

1. Open `/sessions`.
2. Find a completed live session card.
3. Use `Reopen` to move the session back to active.
4. Continue recording from `/active-session`.

## Notes

- Only one live session can be active at a time.
- The mobile bottom nav switches its center action between creating a new session and opening the stack sheet for the active session.
- Table players are managed from the poker table UI inside the active session screen.
