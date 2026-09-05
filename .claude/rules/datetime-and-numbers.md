---
paths:
  - "apps/web/**"
  - "packages/api/**"
---

# Dates, Times & Number Formatting

Why this file exists: the Fable review found repeated one-day-off and negative-duration bugs from mixing UTC storage with local-time reads (SA2-117, 133, 145, 157, 184), plus inconsistent number rendering (SA2-160, 164).

## Date-only values are UTC midnight — read them with UTC getters

`sessionDate`, transaction dates, and any other date-only field are stored as UTC midnight and travel as UTC ISO strings. **Display, editing, and grouping must use `getUTCFullYear` / `getUTCMonth` / `getUTCDate`** (or an explicit `timeZone: "UTC"` formatter). Local getters show the previous day for users west of UTC, and a local-read → save round-trip shifts the stored date one more day per edit (SA2-145, 133).

### Exception: `sessionDate` for live-recorded sessions is a timestamp, not a date-only value

For sessions with `source = "live"`, the server writes the `session_start` timestamp directly to `game_session.sessionDate` (`recalculateCashGameSession` / `recalculateTournamentSession` in [`live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts)). This is not UTC midnight. Both the list ([`session-list-card.tsx`](../../apps/web/src/features/sessions/pages/sessions-page/session-list-card/session-list-card.tsx)) and the detail view ([`session-display.ts`](../../apps/web/src/features/sessions/utils/session-display.ts)) read it with `formatYmdSlash` (UTC getters), so **users outside UTC may see a date one day different from the local calendar date of the start time**. For example, `startedAt = 2026-04-11T03:00Z` is 04-10 20:00 in UTC-7, but displays as "2026/04/11".

The current behavior prioritizes consistent UTC reads across all screens. The edit form likewise populates its date field with `formatDateForInput` (UTC) and makes it read-only for live sessions. If this behavior is corrected, switch the list, detail, edit, and statistics views to local-time reads together; changing only some views makes dates disagree across screens. Use [`formatLocalYmdSlash`](../../apps/web/src/utils/format-number.ts) wherever event timestamps should display their local calendar date.

## Composing times from one date: handle day crossing

When start and end times are combined with a single date (e.g. 22:00–02:00), an `end < start` result means the session crossed midnight — add 24h to the end (`computeSessionTimes` in [`use-sessions.ts`](../../apps/web/src/features/sessions/hooks/use-sessions.ts) is the reference). Never clamp a negative duration to 0 to hide the symptom (SA2-157).

**Fixing a write path is only half the fix**: rows written before the fix stay corrupted. Whenever you correct how data is computed on write, decide explicitly whether existing rows need a backfill migration, and say so in the PR (SA2-184, migration `0034`).

## Period-filter boundaries

An exclusive upper bound (`dateTo` = next-day 00:00) must be compared with `lt`, an inclusive one with `lte` on the last instant. Mixing next-day-midnight with `lte` leaks next-day rows into "last N days" filters (SA2-117).

## Number formatting

- Render numbers through the shared formatters in [`apps/web/src/utils/format-number.ts`](../../apps/web/src/utils/format-number.ts) — do not add new bare `toLocaleString()` / ad-hoc `Intl.NumberFormat` calls; device-locale output diverges between screens (SA2-160).
- Exactly **one** compact (K/M) implementation. A second copy for share text drifted from the in-app one and showed different amounts for the same value (SA2-164). Extend the shared formatter instead of forking it.
