# Statistics

This document owns the design of the statistics domain: EV semantics end to end (the cash-out fallback, the recording gate, population scoping, cross-surface agreement), the currency-scope guard, normalization, breakdown bucketing and sorting, the profit/loss series and P&L graph, the `/statistics` URL filter contract, the shared period-filter domain, and stats number formatting. The server side lives in [`packages/api/src/routers/stats.ts`](../../packages/api/src/routers/stats.ts) and the summary/series parts of [`packages/api/src/routers/session.ts`](../../packages/api/src/routers/session.ts); the web side under [`apps/web/src/features/statistics/`](../../apps/web/src/features/statistics/). Session lifecycle and live-editing design is in [`sessions-and-live-editing.md`](sessions-and-live-editing.md); filter presets (payload union, per-screen scoping, apply path) are owned by [`web-platform.md`](web-platform.md).

## Query scope: filters and the currency-scope guard

Every stats procedure accepts the shared filter shape `statsFilterShape` ([`stats.ts`](../../packages/api/src/routers/stats.ts)): `currencyId`, `type`, `roomId`, `dateFrom` / `dateTo`, `normalized`. Dates are unix **seconds** (converted to ms when querying). `normalized` defaults to `false`; the currency-scope guard is enforced at **runtime, not in the schema**.

**The guard (`assertCurrencyScope`):** comparing raw currency amounts across different currencies is meaningless, so every stats query must either pin a single currency or opt into normalized (bb / buy-in) values. When neither is true the procedure throws `BAD_REQUEST` (`"currencyId is required unless normalized is enabled"`).

`currencyId` and `roomId` are ownership-checked (`validateStatsFiltersOwnership` → `validateEntityOwnership`) per [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md).

> **Warning — cross-layer guard sync.** The web client mirrors this guard in `isCurrencyScopeValid` ([`apps/web/src/features/statistics/utils/stats-filters.ts`](../../apps/web/src/features/statistics/utils/stats-filters.ts)): the scope is valid when either normalization is on (currency optional) or a currency is selected. The two implementations must express the **same predicate**. If the client's copy becomes looser than the server's, every section query on the statistics page fails with `BAD_REQUEST`; if it becomes stricter, the page withholds data the server would happily serve. Whenever either side's rule changes, change the other in the same task.

The client also keeps the scope valid proactively: clearing the currency filter back to "All currencies" produces a combined multi-currency view, which can only be shown normalized (raw amounts across currencies can't be summed) — so the filter bar switches normalization on when it is currently off ([`use-stats-filter-bar.ts`](../../apps/web/src/features/statistics/components/stats-filter-bar/use-stats-filter-bar.ts)).

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

Consequences of the definition:

- An EV cash-out of **0 counts as recorded** — `null` is the only "missing" value.
- EV is resolved only after the cash-game guard: the fallback is defined for a cash-game cash-out, and a tournament row's `cashOut` carries no EV meaning.
- The web layer's optimistic updates mirror `resolveEvCashOut` exactly so nothing shifts when a mutation settles (see [`sessions-and-live-editing.md`](sessions-and-live-editing.md)).

### The recording gate

The summary's EV figures are gated in `buildSummary` ([`stats.ts`](../../packages/api/src/routers/stats.ts)) by three rules that must be read together:

Every EV figure is gated on how many rows actually **recorded** an EV cash-out, not on how many carry an `evProfitLoss` — a finished cash session always carries one, because it falls back to the actual result. Gating on the fallback would hand a user who has never recorded an EV cash-out an "EV diff: 0" card and an EV total identical to `totalProfitLoss`, forever.

The gate is all-or-nothing over the query's scope, which is where it deliberately differs from the per-row rule in the web layer's `displayableEvProfitLoss` (that one hides the EV line row by row). Once **any** session in scope has a tracked EV, the totals span every cash session — the fallback rows contribute their actual result — so the EV total stays comparable with the cash part of `totalProfitLoss` (which also carries the tournaments) instead of being summed over a different, unstated subset.

The bb figure counts its own gate separately: it is summed over a narrower population (cash sessions with a big blind **and** a settled result), so a recorded EV on a row outside that population — a mixed game, which stores blind1–3 as `null` — must not unlock a bb total built entirely out of fallback rows. That would print the same phantom 0 this gate exists to remove, just in bb. It is counted in the very branch that builds `cashEvDiffBbSum` (evDiff settled AND a big blind), so it is a subset of that population and needs no second condition.

### Populations per EV figure

| Figure | Population summed | Gate (else `null`) |
|---|---|---|
| `totalEvDiff`, `totalEvProfitLoss` | **every** finished cash session in scope (fallback rows contribute their actual result) | ≥ 1 session in scope recorded an EV cash-out (`recordedEvCount`) |
| `cashEvDiffNormalized` (bb) | cash sessions with a big blind and a settled `evDiff` | ≥ 1 session **inside that population** recorded an EV cash-out (`recordedEvBbCount`) |

Both EV totals are cash-only: `totalProfitLoss` also carries the tournaments, so the two are the same population only in a cash-scoped query. A `null` means "the user never tracked EV in this scope" and renders as `—`; it must never be collapsed to 0 — the row still carries EV figures, they just are not evidence that the user tracked EV, so the gate must not count them.

### Cross-surface agreement

The same EV summary exists on two surfaces, and **the two summaries must not disagree over one scope**:

- `stats.summary` gates in `buildSummary` as above.
- `session.list`'s `SessionSummary` carries cash-only EV aggregates gated the **same way** (`accumulateEvMetrics` in [`session.ts`](../../packages/api/src/routers/session.ts)): `null` unless a session in scope stored a real EV cash-out, otherwise summed over every finished cash session with fallback rows counting at their actual result. Its `recordedEvCount` counts the sessions that actually **stored** an EV cash-out, not the ones that got a resolved value — the resolved `evCashOut` falls back to the actual cash-out, so counting it would leave the gate true for every finished cash session and report "EV diff: 0" to a user who never tracked EV.

Editing the gate condition, the fallback, or the population on one surface without the other silently splits the app into two contradicting summaries. Keep them in lockstep, and extend the paired tests on both routers when the rule changes.

### The per-row display gate (web layer)

The scope-level gate above deliberately differs from the per-session rule. `displayableEvProfitLoss` in [`apps/web/src/features/sessions/utils/session-display.ts`](../../apps/web/src/features/sessions/utils/session-display.ts) is the one place that decides which EV figure a single session shows (or `null` for none) — the list card, the detail hero and the share text all read through it, so they cannot disagree.

- The gate is the raw `evCashOut`, not `evProfitLoss`. The fallback is what puts untracked sessions into the EV statistics, but printing it per row would just repeat the P&L as a second identical line — so a row shows an EV figure only when the user actually recorded one.
- The rule is deliberately "the user recorded no EV cash-out", **not** "the EV difference is 0". A manual entry whose EV happened to match its result still shows its EV line, and a live cash game with no all-in logged keeps showing one too (the server always writes it an `evCashOut`) — there the app tracked EV throughout, so "EV difference was 0" is a real observation rather than an absence of information.

## Normalization

### One mode, two units, never summed

Normalization is a single mode. **"off"** shows currency amounts (a currency must be selected — see the scope guard); **"normalized"** shows big-blind (cash) and buy-in (tournament) normalized values *simultaneously*. BB and BI live on different scales and **must never be summed together**, so any view that mixes cash and tournament sessions presents the two units side by side rather than combined:

- The summary keeps `cashNormalizedProfitLoss` (bb) and `tournamentNormalizedProfitLoss` (bi) as separate fields; breakdown rows likewise keep `cashNormalizedProfitLoss` apart from `tournamentNormalizedProfitLoss`; the accumulator tracks the normalized sums per game type while currency profit/loss is always tracked combined.
- The KPI cards show a single typed card for a single game type and **two** separate cards (BB + BI) when the type filter is "all".
- The P&L graph's dual-axis mode exists only for the normalized "all" scope (bb cash vs. bi tournament), with y-axis domains computed so the zero line of the BB and BI series sits at the same vertical position ([`aligned-domains.ts`](../../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/aligned-domains.ts)).
- A win is counted as currency-sign positive `profitLoss`, regardless of normalization.

### Per-session normalized value

`normalizedSessionValue` ([`stats.ts`](../../packages/api/src/routers/stats.ts)): cash → bb units (`profitLoss / bigBlind`), tournament → buy-ins (`profitLoss / buyInTotal`). `null` when the denominator is missing or zero, so non-normalizable sessions are **excluded** from normalized aggregates. A mixed cash structure has no single flat big blind, so it can never produce a bb value — in the normalized breakdown table its raw P&L stays visible instead of reducing the row to Group / Sessions / Play time (or an unexplained dash), and in normalized mode a bb/bi column is hidden entirely when no group has a value for it (e.g. a cash-only scope has no bi figures).

Even in normalized mode the selected currency's unit is still resolved: normalized values pick bb / bi via `unitForType`, but currency-only figures (e.g. total prize) still need the real unit ([`use-statistics-page.ts`](../../apps/web/src/features/statistics/pages/statistics-page/use-statistics-page.ts)).

### Currency-agnostic vs. currency-pinned figures

Aggregate ROI and Total prize sum **raw currency amounts**, so they are only meaningful when a single currency is pinned. Without one (e.g. the default normalized scope) they would blend currencies, so they are hidden; only the currency-agnostic figures remain:

- `avgRoi` — mean of per-session ROI %. Each session's ROI is a ratio, so it is safe across currencies, and it is deliberately distinct from the aggregate `roi` (e.g. sessions invested 300 returning 400: aggregate `(400−300)/300×100 ≈ 33.33` differs from the mean of per-session percentages).
- ITM rate and average placement — count-based.
- Prize money is always a currency amount, so it stays in currency units even when normalization is on.

The tournament stat table and cash-game stat table always query with their type **forced** (`tournament` / `cash_game`) so each block stays game-specific even when the global type filter is "all".

### Rate metrics

Hands are not tracked, so there is no bb/100 metric anywhere — `bbPerHour` (sum of bb won / cash play hours) is provided as the rate proxy instead. The cash-game stat table's omission of bb/100 is deliberate, not an oversight.

## Breakdown

`stats.breakdown` groups the filtered rows by one of: `room`, `stakes`, `type`, `dayOfWeek`, `length`, `month`, `year`, `variant`.

**Key/label mapping (`breakdownKeyLabel`):** returns `null` to **exclude** a row from the grouping — tournaments have no stakes (they are excluded from the `stakes` dimension entirely), and a session with no recorded duration has no `length` bucket. `dayOfWeek` / `month` / `year` buckets use UTC consistently (see [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md)); `length` buckets by whole hours of duration (`2~3h`).

**Variant grouping:** the server returns the raw variant string as both key and label. A mix session has variant `"mix"` and therefore groups as **one** bucket — never decomposed into its sub-games. Only the client's `variant` tab maps that raw string through `variantDisplayLabel` for display: `"mix"` resolves to "Mixed Game", and every other stored variant is already a display label (or a legacy cached preset key) and passes through verbatim. Every other tab keeps the server's label as-is.

**Sort contract (`sortBreakdownRows`):**

| Dimensions | Order |
|---|---|
| `dayOfWeek`, `length`, `year` | ascending by numeric key |
| `month` | ascending by `"YYYY-MM"` lexical key |
| `room`, `stakes`, `type`, `variant` | `sessions` desc → `profitLoss` desc → `label` asc |

**Client tab availability:** `stakes` is meaningful for cash games only, so the tab is offered when — and only when — the type filter is pinned to cash game; `variant` is meaningful for every type filter. The active tab is always **coerced** to a currently available dimension, so switching the type filter away from cash game while `stakes` is selected never sends an invalid grouping to the server ([`use-breakdown-section.ts`](../../apps/web/src/features/statistics/pages/statistics-page/breakdown-section/use-breakdown-section.ts)).

## Profit/loss series and the P&L graph

### One resolver, two surfaces

The series resolver body (`fetchProfitLossSeries` in [`session.ts`](../../packages/api/src/routers/session.ts)) is shared: `session.profitLossSeries` (which keeps its `ringGameId` filter) and `stats.profitLossSeries` reuse the exact same selection and point mapping, keeping the point shape identical across both surfaces. Change the point shape in one place only.

### Chronological order key (SA2-98)

`sessionDate` is date-only — it has no time component, so same-day sessions all share the same value; sorting by it alone left same-day ordering to fall back to `id` (effectively random) instead of actual play order (SA2-98). The sort key is therefore the session's actual `startedAt` when known, falling back to the date-only `sessionDate`. The rule exists in three places that must agree: the DB query's `sessionOrderKeySql()`, the series point mapping in `session.ts`, and the client-side `sortKey` in [`aggregate-pnl-points.ts`](../../apps/web/src/features/statistics/utils/aggregate-pnl-points.ts).

### The EV-toggle availability latch

[`use-pnl-graph.ts`](../../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/use-pnl-graph.ts) owns the x-axis and EV-cash toggle state, runs the `stats.profitLossSeries` query, and folds the raw series into chart-ready cumulative points via the pure `aggregatePnlPoints` aggregator. The unit follows the global normalization filter.

The EV line is cash-only, and it only says something the P/L line does not when at least one session actually recorded an EV cash-out: a point with no recorded EV falls back to its actual result, so a series made entirely of those draws an EV line directly on top of the P/L line. Hiding the toggle is the graph's version of the `—` the KPI cards show for the same user — so the toggle is gated on both conditions and its effective value forced off otherwise.

Only a loaded series can answer "did anyone record EV?", and changing a filter swaps the query key so `data` goes back to `undefined` mid-answer. Neither default works on its own: treating "not loaded" as unavailable unmounts the Switch on every period / room / currency change (while the toolbar around it stays put), and treating it as available pops a Switch into that toolbar on every load for exactly the user this gate exists to spare. So the hook carries the **last resolved verdict** across the gap — it starts hidden, and only a loaded series ever moves it. The write is idempotent, so a double render under React StrictMode reaches the same value.

A persisted cache entry written before `evRecorded` existed rehydrates without the flag, which reads as "no recorded EV" and hides the toggle until the query refetches — the safe direction, so no cache buster is needed (see the SA2-154 cache-shape policy in [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md)).

## The `/statistics` URL filter contract

Filters are URL search params validated by `statsSearchSchema` ([`stats-filters.ts`](../../apps/web/src/features/statistics/utils/stats-filters.ts)) and read/written through [`use-stats-filters.ts`](../../apps/web/src/features/statistics/hooks/use-stats-filters.ts).

**Schema decisions:**

- `period` — preset / custom date window, shared with the sessions filter (see Period filter below); defaults to `"all"`.
- `from` / `to` — custom-range bounds, unix seconds, `z.coerce.number().int()` because raw URL values arrive as strings on a cold load / shared link.
- `norm` — defaults to normalized (BB / BI) so the page shows data without first requiring a single-currency selection (this is what makes the default scope pass the currency-scope guard).
- An empty-string `currency` / `room` (reachable as `?room=`) counts as **absent**, matching how `filtersToStatsInput` coerces it.

### Pristine-URL detection (default-preset auto-apply gate)

"May a default preset take over?" is answered by `isDefaultStatsFilterState`: true when no filter differs from its schema default. It deliberately does **not** look at the router's search object. `/statistics` declares `validateSearch: statsSearchSchema`, and TanStack Router writes that schema's defaults into `location.search` **and into the URL itself**, so a bare `/statistics` is indistinguishable from an explicit link there — the search object always carries `period` / `norm` / `type`. The first implementation checked `Object.keys(location.search).length === 0` and was therefore **permanently false**, silently disabling the default preset while every unit test stayed green (they all mocked the router wholesale). Comparing filter values against the schema defaults instead means a genuine deep link (`?type=tournament`) is respected — auto-applying a default preset over it would clobber the link the user actually opened — while a bare load, or a link that merely spells the defaults out, is treated as pristine. This is pinned against a **real** router by [`apps/web/src/__tests__/statistics-raw-search.test.tsx`](../../apps/web/src/__tests__/statistics-raw-search.test.tsx); keep that test real-router when touching this area.

### Applying a preset: full replace + graceful degradation

`replaceFilters` fully replaces the URL search params with the payload — unlike `setFilters`, fields the payload omits fall back to the **schema's own defaults** rather than whatever was previously in the URL. A preset that doesn't mention `room` must actually clear a previously-set room, not merge over it.

The re-parse uses `safeParse`, not `parse`: the payload can come from a saved filter preset, whose stored vocabulary is looser than this schema's ([`packages/db/src/schemas/filter-preset.ts`](../../packages/db/src/schemas/filter-preset.ts) validates `period` as a bounded string because packages/db can't import apps/web's `PERIODS`). A preset holding a period this build no longer knows must degrade to "keep the current filters", not throw — `replaceFilters` runs inside the default-preset auto-apply effect during mount, where a throw would take the whole page down. The same layering is why `onApplyPreset` type-asserts the payload: presets saved from this screen only ever carry values drawn from `PERIODS` / `STATS_NORMALIZATIONS` / `STATS_TYPES`, and `replaceFilters` re-validates regardless of what TypeScript narrows.

Symmetrically on save, the payload handed to the presets sheet is **not** `filters` verbatim: the stored schema declares `currency` / `room` as `.min(1).optional()`, while a hand-edited `/statistics?room=` parses to an empty string — passing that through made Save fail with a raw Zod error. Empty means "absent" here, matching `filtersToStatsInput` (mirrors the sessions bar's `currentPresetPayload`).

### Auto-apply wiring

The statistics-screen preset CRUD surface is self-contained in `StatsFilterBar` → `FilterPresetsSheet`, which mounts its own `useFilterPresets` — the page hook only wires the "auto-apply the default preset on first load" behaviour, shared with the Sessions list through `useDefaultFilterPreset`. The one-shot auto-apply latch keys on `isSuccess`, precisely so a **failed** query (stopped loading, never answered) does not spend the one shot. Preset storage, payload union and per-screen scoping are documented in [`web-platform.md`](web-platform.md).

## Period filter (SA2-74)

[`apps/web/src/shared/lib/period-filter.ts`](../../apps/web/src/shared/lib/period-filter.ts) is the date/period filter domain shared by the statistics **and** sessions filter bars (SA2-74). It is kept feature-neutral in `shared/lib` so neither feature imports the other for it; the sessions list reuses it so its filter header behaves identically to statistics.

- Preset resolution translates the selected period into a concrete `{ dateFrom?, dateTo? }` window in unix seconds. Relative windows snap their bounds to **UTC day boundaries** so the value — and therefore any query key built from it — only changes once a day, not on every render. The upper bound is the end of today, so future-dated rows are excluded from "last N days" / YTD windows.
- Custom ranges convert a `yyyy-mm-dd` date-input value to unix seconds (UTC); `endOfDay` snaps to 23:59:59 so an upper bound is inclusive of the whole day. An empty / malformed value returns `undefined` so the bound is cleared. The reverse conversion (unix seconds → `yyyy-mm-dd`, UTC) feeds the date input.

Inclusive-vs-exclusive boundary comparison rules (SA2-117) and the UTC-getter discipline are imperatives in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) — this module is written against them, not an exception to them.

## Stats number formatting

[`format-stats.ts`](../../apps/web/src/features/statistics/utils/format-stats.ts) formats a stats value to at most `maxDecimals` decimal places, with k / M / B compaction for large magnitudes, kept to **~4 significant figures** so normalized (bb / bi) values never render a long decimal tail. The decimal count is chosen to keep a value < 1000 within ~4 significant figures, and each normalized unit has a minimum granularity: **bb = 1 decimal, bi = 2 decimals**. This is the stats-specific layer on top of the shared formatter rules (single compact implementation, no ad-hoc `toLocaleString`) in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md).
