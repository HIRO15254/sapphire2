---
paths:
  - "apps/web/**"
  - "packages/api/**"
---

# Dates, Times & Number Formatting

Why this file exists: the Fable review found repeated one-day-off and negative-duration bugs from mixing UTC storage with local-time reads (SA2-117, 133, 145, 157, 184), plus inconsistent number rendering (SA2-160, 164).

## Date-only values are UTC midnight — read them with UTC getters

`sessionDate`, transaction dates, and any other date-only field are stored as UTC midnight and travel as UTC ISO strings. **Display, editing, and grouping must use `getUTCFullYear` / `getUTCMonth` / `getUTCDate`** (or an explicit `timeZone: "UTC"` formatter). Local getters show the previous day for users west of UTC, and a local-read → save round-trip shifts the stored date one more day per edit (SA2-145, 133).

### 例外: ライブ記録セッションの `sessionDate` は日付ではなくタイムスタンプ

`source = "live"` のセッションでは、サーバが `game_session.sessionDate` に `session_start` の時刻をそのまま書く（[`live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts) の `recalculateCashGameSession` / `recalculateTournamentSession`）。つまり UTC 深夜ではない。表示側は一覧 [`session-list-card.tsx`](../../apps/web/src/features/sessions/pages/sessions-page/session-list-card/session-list-card.tsx) も詳細 [`session-display.ts`](../../apps/web/src/features/sessions/utils/session-display.ts) も `formatYmdSlash`（UTC ゲッター）で読むため、**UTC 外のユーザーでは開始時刻の暦日と 1 日ずれることがある**（例: `startedAt = 2026-04-11T03:00Z` は UTC-7 では 04-10 20:00 だが「2026/04/11」と表示される）。

現状は「全画面が同じ UTC 読みで一致している」状態を優先しており、編集フォームの日付欄も同じ `formatDateForInput`（UTC）で埋めてライブでは読み取り専用にしてある。直すなら一覧・詳細・編集・統計をまとめてローカル読みに揃えること（片側だけ変えると画面間で日付が食い違う）。イベントのタイムスタンプをローカル暦日で見せたい箇所には [`formatLocalYmdSlash`](../../apps/web/src/utils/format-number.ts) を使う。

## Composing times from one date: handle day crossing

When start and end times are combined with a single date (e.g. 22:00–02:00), an `end < start` result means the session crossed midnight — add 24h to the end (`computeSessionTimes` in [`use-sessions.ts`](../../apps/web/src/features/sessions/hooks/use-sessions.ts) is the reference). Never clamp a negative duration to 0 to hide the symptom (SA2-157).

**Fixing a write path is only half the fix**: rows written before the fix stay corrupted. Whenever you correct how data is computed on write, decide explicitly whether existing rows need a backfill migration, and say so in the PR (SA2-184, migration `0034`).

## Period-filter boundaries

An exclusive upper bound (`dateTo` = next-day 00:00) must be compared with `lt`, an inclusive one with `lte` on the last instant. Mixing next-day-midnight with `lte` leaks next-day rows into "last N days" filters (SA2-117).

## Number formatting

- Render numbers through the shared formatters in [`apps/web/src/utils/format-number.ts`](../../apps/web/src/utils/format-number.ts) — do not add new bare `toLocaleString()` / ad-hoc `Intl.NumberFormat` calls; device-locale output diverges between screens (SA2-160).
- Exactly **one** compact (K/M) implementation. A second copy for share text drifted from the in-app one and showed different amounts for the same value (SA2-164). Extend the shared formatter instead of forking it.
