# Statistics

This document owns the design of the statistics domain: EV semantics end to end (the cash-out fallback, the recording gate, population scoping, cross-surface agreement), the currency-scope guard, normalization, breakdown bucketing, the profit/loss series and P&L graph, the `/statistics` URL filter contract, the shared period-filter domain, and stats number formatting. The server side lives in [`packages/api/src/routers/stats.ts`](../../packages/api/src/routers/stats.ts) and the summary/series parts of [`packages/api/src/routers/session.ts`](../../packages/api/src/routers/session.ts); the web side under [`apps/web/src/features/statistics/`](../../apps/web/src/features/statistics/). Session lifecycle and live-editing design is in [`sessions-and-live-editing.md`](sessions-and-live-editing.md); filter presets (payload union, per-screen scoping, apply path) are owned by [`web-platform.md`](web-platform.md).

## Query scope: filters and the currency-scope guard

Every stats procedure accepts the shared filter shape `statsFilterShape` ([`stats.ts`](../../packages/api/src/routers/stats.ts)): `currencyId`, `type`, `roomId`, `dateFrom` / `dateTo` (unix **seconds**, converted to ms when querying), `normalized` (defaults to `false`). `currencyId` and `roomId` are ownership-checked (`validateStatsFiltersOwnership`) per [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md); the currency-scope guard is enforced at **runtime, not in the schema**.

**The guard (`assertCurrencyScope`):** comparing raw currency amounts across different currencies is meaningless, so every stats query must either pin a single currency or opt into normalized (bb / buy-in) values. When neither is true the procedure throws `BAD_REQUEST` (`"currencyId is required unless normalized is enabled"`).

> **Warning — cross-layer guard sync.** The web client mirrors this guard in `isCurrencyScopeValid` ([`apps/web/src/features/statistics/utils/stats-filters.ts`](../../apps/web/src/features/statistics/utils/stats-filters.ts)): the scope is valid when either normalization is on (currency optional) or a currency is selected. The two implementations must express the **same predicate**. If the client's copy becomes looser than the server's, every section query on the statistics page fails with `BAD_REQUEST`; if it becomes stricter, the page withholds data the server would happily serve. Whenever either side's rule changes, change the other in the same task.

The client also keeps the scope valid proactively: clearing the currency filter back to "All currencies" produces a combined multi-currency view, which can only be shown normalized — so the filter bar switches normalization on when it is currently off ([`use-stats-filter-bar.ts`](../../apps/web/src/features/statistics/components/stats-filter-bar/use-stats-filter-bar.ts)).

## The stats row model

Stats procedures fold sessions into `StatsSessionRow`. Field semantics that are easy to get wrong:

| Field | Semantics |
|---|---|
| `bigBlind` | cash `blind2` |
| `buyInTotal` | tournament total invested, or `null` if 0 |
| `evDiff` | cash only: `evProfitLoss - profitLoss` |
| `evProfitLoss` | cash only (falls back to the actual result — see EV semantics) |
| `evRecorded` | whether the session stores a **real** EV cash-out (see below) |
| `prizeMoney` | tournament prize money only — does **not** include bounty (bounties are added separately) |
| `profitLoss` | currency units |
| `sessionDate` | unix seconds |
| `variant` | frozen detail-row variant string (cash or tournament) |

**`evRecorded`:** `evProfitLoss` alone cannot answer "did the user track EV?" — it falls back to the actual result, so every finished cash session has one. Only this flag distinguishes "tracked EV" from "assumed EV", and the summary gates its EV figures on it. The profit/loss series carries the same flag on each point, with the same definition, so the graph can decide whether an EV line would say anything the P/L line does not. The two definitions (stats row and series point) must not drift.

**Chip removes:** a cash session's P/L adds racked-off chips back: `profitLoss = cashOut + chipRemoveTotal − buyIn` (e.g. `600 + 100 − 500 = 200`, not the chip-remove-blind `600 − 500 = 100`). The same `chipRemoveTotal` is added into `evProfitLoss` as well, so `evDiff` stays isolated to all-in equity — a chip remove never manufactures an EV difference (SA2-124). The underlying chip-remove P/L design lives in [`sessions-and-live-editing.md`](sessions-and-live-editing.md); the stats layer's obligation is to keep both figures (actual and EV) treated identically.

## EV semantics

### The cash-out fallback

Recording an EV cash-out is optional. A cash session without one is **defined** to have run exactly as expected: `resolveEvCashOut` ([`session.ts`](../../packages/api/src/routers/session.ts)) falls back to the actual cash-out, so its EV P/L equals its real result and its EV difference is 0. Without the fallback those sessions dropped out of every EV figure entirely, which made the EV totals a sum over an unstated subset of the filtered sessions rather than over all of them.

- An EV cash-out of **0 counts as recorded** — `null` is the only "missing" value.
- EV is resolved only after the cash-game guard: the fallback is defined for a cash-game cash-out, and a tournament row's `cashOut` carries no EV meaning.
- The web layer's optimistic updates mirror `resolveEvCashOut` exactly so nothing shifts when a mutation settles (see [`sessions-and-live-editing.md`](sessions-and-live-editing.md)).

### The recording gate

The summary's EV figures are gated in `buildSummary` ([`stats.ts`](../../packages/api/src/routers/stats.ts)) by three rules that must be read together:

Every EV figure is gated on how many rows actually **recorded** an EV cash-out, not on how many carry an `evProfitLoss` — a finished cash session always carries one, because it falls back to the actual result. Gating on the fallback would hand a user who has never recorded an EV cash-out an "EV diff: 0" card and an EV total identical to `totalProfitLoss`, forever.

The gate is all-or-nothing over the query's scope, which is where it deliberately differs from the per-row rule in the web layer's `displayableEvProfitLoss` (that one hides the EV line row by row). Once **any** session in scope has a tracked EV, the totals span every cash session — the fallback rows contribute their actual result — so the EV total stays comparable with the cash part of `totalProfitLoss` (which also carries the tournaments) instead of being summed over a different, unstated subset.

The bb figure counts its own gate separately: it is summed over a narrower population (cash sessions with a big blind **and** a settled result), so a recorded EV on a row outside that population — a mixed game, which stores blind1–3 as `null` — must not unlock a bb total built entirely out of fallback rows. That would print the same phantom 0 this gate exists to remove, just in bb. It is counted in the very branch that builds `cashEvDiffBbSum` (evDiff settled AND a big blind), so it is a subset of that population and needs no second condition.

Either gated-off figure is `null` — "the user never tracked EV in this scope" — and renders as `—`; it must never be collapsed to 0. The rows still carry EV figures (the fallback), they just are not evidence that the user tracked EV. Both EV totals are cash-only: `totalProfitLoss` also carries the tournaments, so the two are the same population only in a cash-scoped query.

### Cross-surface agreement

The same EV summary exists on two surfaces, and **the two summaries must not disagree over one scope**: `stats.summary` gates in `buildSummary` as above, and `session.list`'s `SessionSummary` carries cash-only EV aggregates gated the **same way** (`accumulateEvMetrics` in [`session.ts`](../../packages/api/src/routers/session.ts)) — `null` unless a session in scope stored a real EV cash-out, otherwise summed over every finished cash session with fallback rows counting at their actual result. Its `recordedEvCount` counts the sessions that actually **stored** an EV cash-out, not the ones that got a resolved value — the resolved `evCashOut` falls back to the actual cash-out, so counting it would leave the gate true for every finished cash session and report "EV diff: 0" to a user who never tracked EV.

Editing the gate condition, the fallback, or the population on one surface without the other silently splits the app into two contradicting summaries. Keep them in lockstep, and extend the paired tests on both routers when the rule changes.

### The per-row display gate (web layer)

The scope-level gate above deliberately differs from the per-session rule. `displayableEvProfitLoss` in [`apps/web/src/features/sessions/utils/session-display.ts`](../../apps/web/src/features/sessions/utils/session-display.ts) is the one place that decides which EV figure a single session shows (or `null` for none) — the list card, the detail hero and the share text all read through it, so they cannot disagree. The gate is the raw `evCashOut`, not `evProfitLoss` (printing the fallback per row would just repeat the P&L as a second identical line), and the rule is deliberately "the user recorded no EV cash-out", **not** "the EV difference is 0": a manual entry whose EV happened to match its result still shows its EV line, and so does a live cash game with no all-in logged (the server always writes it an `evCashOut`) — there "EV difference was 0" is a real observation rather than an absence of information.

## Normalization

### One mode, two units, never summed

Normalization is a single mode. **"off"** shows currency amounts (a currency must be selected — see the scope guard); **"normalized"** shows big-blind (cash) and buy-in (tournament) normalized values *simultaneously*. BB and BI live on different scales and **must never be summed together**, so any view that mixes cash and tournament sessions presents the two units side by side rather than combined:

- The summary and breakdown rows keep `cashNormalizedProfitLoss` (bb) and `tournamentNormalizedProfitLoss` (bi) as separate fields; the KPI cards show a single typed card for a single game type and **two** separate cards (BB + BI) when the type filter is "all".
- The P&L graph's dual-axis mode exists only for the normalized "all" scope (bb cash vs. bi tournament), with y-axis domains computed so the zero line of the BB and BI series sits at the same vertical position ([`aligned-domains.ts`](../../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/aligned-domains.ts)).
- A win is counted as currency-sign positive `profitLoss`, regardless of normalization.

### Per-session normalized value

`normalizedSessionValue` ([`stats.ts`](../../packages/api/src/routers/stats.ts)): cash → bb units (`profitLoss / bigBlind`), tournament → buy-ins (`profitLoss / buyInTotal`). `null` when the denominator is missing or zero, so non-normalizable sessions are **excluded** from normalized aggregates. A mixed cash structure has no single flat big blind (blind1–3 are `null`), so it can never produce a bb value — in the normalized breakdown its raw P&L stays visible instead of an unexplained dash, and a bb/bi column is hidden entirely when no group has a value for it.

### Currency-agnostic vs. currency-pinned figures

Aggregate ROI and Total prize sum **raw currency amounts**, so they are only meaningful when a single currency is pinned. Without one (e.g. the default normalized scope) they would blend currencies, so they are hidden; only the currency-agnostic figures remain:

- `avgRoi` — mean of per-session ROI %. Each session's ROI is a ratio, so it is safe across currencies, and it is deliberately distinct from the aggregate `roi` (e.g. sessions invested 300 returning 400: aggregate `(400−300)/300×100 ≈ 33.33` differs from the mean of per-session percentages).
- ITM rate and average placement are count-based; prize money is always a currency amount, so it stays in currency units even when normalization is on.

### Rate metrics

Hands are not tracked, so there is no bb/100 metric anywhere — `bbPerHour` (sum of bb won / cash play hours) is provided as the rate proxy instead. The cash-game stat table's omission of bb/100 is deliberate, not an oversight.

## Breakdown

`stats.breakdown` groups the filtered rows by one of: `room`, `stakes`, `type`, `dayOfWeek`, `length`, `month`, `year`, `variant`. **Key/label mapping (`breakdownKeyLabel`)** returns `null` to **exclude** a row from the grouping — tournaments have no stakes (they are excluded from the `stakes` dimension entirely), and a session with no recorded duration has no `length` bucket. `dayOfWeek` / `month` / `year` buckets use UTC consistently (see [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md)); `length` buckets by whole hours of duration (`2~3h`).

**Variant grouping:** a mix session has variant `"mix"` and groups as **one** bucket — never decomposed into its sub-games. The server returns the raw variant string as both key and label; only the client's `variant` tab maps it through `variantDisplayLabel` (`"mix"` → "Mixed Game", every other stored variant passes through verbatim).

## Profit/loss series and the P&L graph

### Chronological order key (SA2-98)

`sessionDate` is date-only — it has no time component, so same-day sessions all share the same value; sorting by it alone left same-day ordering to fall back to `id` (effectively random) instead of actual play order (SA2-98). The sort key is therefore the session's actual `startedAt` when known, falling back to the date-only `sessionDate`. The rule exists in three places that must agree: the DB query's `sessionOrderKeySql()`, the series point mapping in `session.ts`, and the client-side `sortKey` in [`aggregate-pnl-points.ts`](../../apps/web/src/features/statistics/utils/aggregate-pnl-points.ts).

### The EV-toggle availability latch

[`use-pnl-graph.ts`](../../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/use-pnl-graph.ts) gates the EV-cash toggle: the EV line is cash-only, and it only says something the P/L line does not when at least one session in the series actually recorded an EV cash-out — a series made entirely of fallback points draws the EV line directly on top of the P/L line. Hiding the toggle is the graph's version of the `—` the KPI cards show for the same user.

Only a loaded series can answer "did anyone record EV?", and changing a filter swaps the query key so `data` goes back to `undefined` mid-answer — so the hook carries the **last resolved verdict** across the gap (it starts hidden, and only a loaded series ever moves it) instead of unmounting the Switch on every filter change or popping one in front of exactly the user this gate exists to spare. A cache entry persisted before `evRecorded` existed rehydrates without the flag, which reads as "no recorded EV" and hides the toggle until the query refetches — the safe direction, so no cache buster is needed (see the SA2-154 cache-shape policy in [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md)).

## The `/statistics` URL filter contract

Filters are URL search params validated by `statsSearchSchema` ([`stats-filters.ts`](../../apps/web/src/features/statistics/utils/stats-filters.ts)) and read/written through [`use-stats-filters.ts`](../../apps/web/src/features/statistics/hooks/use-stats-filters.ts). `norm` defaults to normalized (BB / BI) so the page shows data without first requiring a single-currency selection — this is what makes the default scope pass the currency-scope guard. `from` / `to` are `z.coerce.number().int()` because raw URL values arrive as strings on a cold load / shared link, and an empty-string `currency` / `room` (reachable as `?room=`) counts as **absent**, matching how `filtersToStatsInput` coerces it. `period` is the preset / custom date window shared with the sessions filter (see Period filter below).

### Pristine-URL detection (default-preset auto-apply gate)

"May a default preset take over?" is answered by `isDefaultStatsFilterState`: true when no filter differs from its schema default. It deliberately does **not** look at the router's search object — TanStack Router writes `statsSearchSchema`'s defaults into `location.search` **and into the URL itself**, so a bare `/statistics` is indistinguishable from an explicit link there. The first implementation checked `Object.keys(location.search).length === 0` and was therefore **permanently false**, silently disabling the default preset while every unit test stayed green (they all mocked the router wholesale). Comparing filter values against schema defaults respects a genuine deep link (`?type=tournament`) while treating a bare load — or a link that merely spells the defaults out — as pristine. This is pinned against a **real** router by [`apps/web/src/__tests__/statistics-raw-search.test.tsx`](../../apps/web/src/__tests__/statistics-raw-search.test.tsx); keep that test real-router when touching this area.

### Applying a preset: full replace + graceful degradation

`replaceFilters` fully replaces the URL search params with the payload — fields the payload omits fall back to the **schema's own defaults**, so a preset that doesn't mention `room` actually clears a previously-set room instead of merging over it. The re-parse uses `safeParse`, not `parse`: a saved preset's stored vocabulary is looser than this schema ([`packages/db/src/schemas/filter-preset.ts`](../../packages/db/src/schemas/filter-preset.ts) validates `period` as a bounded string because packages/db can't import apps/web's `PERIODS`), and a preset holding a period this build no longer knows must degrade to "keep the current filters", not throw — `replaceFilters` runs inside the default-preset auto-apply effect during mount, where a throw would take the whole page down.

## Period filter (SA2-74)

[`apps/web/src/shared/lib/period-filter.ts`](../../apps/web/src/shared/lib/period-filter.ts) is the date/period filter domain shared by the statistics **and** sessions filter bars (SA2-74), kept feature-neutral in `shared/lib` so neither feature imports the other for it. Inclusive-vs-exclusive boundary comparison rules (SA2-117) and the UTC-getter discipline are imperatives in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) — this module is written against them, not an exception to them.

- Preset resolution translates the selected period into a concrete `{ dateFrom?, dateTo? }` window in unix seconds. Relative windows snap their bounds to **UTC day boundaries** so the value — and therefore any query key built from it — only changes once a day, not on every render. The upper bound is the end of today, so future-dated rows are excluded from "last N days" / YTD windows.
- Custom ranges convert a `yyyy-mm-dd` date-input value to unix seconds (UTC); `endOfDay` snaps to 23:59:59 so an upper bound is inclusive of the whole day. An empty / malformed value returns `undefined` so the bound is cleared. The reverse conversion (unix seconds → `yyyy-mm-dd`, UTC) feeds the date input.

## Stats number formatting

[`format-stats.ts`](../../apps/web/src/features/statistics/utils/format-stats.ts) is the stats-specific compaction layer (k / M / B, ~4 significant figures, per-unit minimum decimals: bb = 1, bi = 2) on top of the shared formatter rules (single compact implementation, no ad-hoc `toLocaleString`) in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md).
