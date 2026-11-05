# Statistics

This document owns the statistics domain on the v2 data model ([data-model-v2.md](data-model-v2.md) §12, API contract in [api-after-data-model-v2.md](api-after-data-model-v2.md) §13): the population, the three modes, coverage, the normalization units, EV semantics, time, and the breakdown and series keys. The procedures live in [`routers/stats.ts`](../../packages/api/src/routers/stats.ts); [`services/stats-data.ts`](../../packages/api/src/services/stats-data.ts) loads the population and [`services/stats.ts`](../../packages/api/src/services/stats.ts) computes the figures. Every conversion goes through [`services/valuation.ts`](../../packages/api/src/services/valuation.ts). U11 (SA2-420) rebuilds the statistics UI.

## Filter and population

The filter is `statsFilterSchema` in [`packages/db/src/schemas/stats-filter.ts`](../../packages/db/src/schemas/stats-filter.ts), shared with the saved filter presets so a preset can always be replayed as a query. It is one flat object refined with `refineStatsFilter`, not a union, so MCP clients see a single plain schema.

- **Only `status = 'settled'` entries count.** An open live entry has no final result and never enters a figure.
- `dateFrom` / `dateTo` are inclusive `YYYY-MM-DD` strings compared with `entry.played_on` as text. The day, month, year and series axes read `played_on` too, so an entry played across UTC midnight stays on the local day the user recorded.
- `entryTagIds` matches entries carrying any of the tags; `tournamentTagIds` matches entries whose tournament carries any of them. Different filters intersect. Tag ids are resolved into id sets in chunks and applied in memory to stay inside D1's bound-parameter cap.
- `roomId`, every tag id, `assetId` and `baseAssetId` are ownership-checked with a uniform `FORBIDDEN`; `baseAssetId` must be a currency.

## Modes

Exactly one mode is required; combining them is `BAD_REQUEST`.

| Mode | Input | Amounts |
|---|---|---|
| Native | `assetId` | Sum of that asset's **real** lines, unconverted. Population: entries with at least one real line in the asset. |
| Valuation | `valuation: real \| virtual`, optional `baseAssetId` | Every line converted into the base. The base falls back to `user_setting.base_asset_id`; with neither the call is `PRECONDITION_FAILED`. |
| Normalized | `normalized: true` | Cash in bb, tournaments in bi, as two separate branches. `amounts`, `roi` and the monetary EV figures are `null`. |

- **Native mode never zeroes another asset.** An entry that also used other assets still counts with only its lines in the selected asset; it is counted in `multiAssetEntryCount` and the other assets are listed in `otherAssetIds`.
- **Valuation mode never counts an unconvertible line as 0.** An entry with a line that has no rate at its time is excluded from every figure and reported in `excludedEntryCount` and `missingRates` (asset plus the earliest uncovered `occurredAt`). `real` values real currency lines only; `virtual` also values items and virtual lines (§12.1).
- `entryCount` is the population after filters, before exclusions. Every other figure — wins, rates, time, hands, ROI, amounts — covers only the entries that produced a value in the mode.

## Units

- **1 bb** exists only for a cash entry whose rule lineup has exactly one game group and a positive `blind2`, and whose real currency lines are all in `entry.asset_id`; the P/L in that asset is divided by `blind2`. Anything else is counted in `unavailableNormalizationEntryCount`.
- **1 bi** is the tournament's **first** `buy_in` line (by `occurredAt`, then id) plus the fee paired with it: the fee with the same event, else the same price on the same play session, else the earliest unpaired fee on the same play session. Re-entries, their fees and add-ons are not part of the unit — they are still money paid, so they stay in ROI. When the unit and the real currency lines share one asset the bi is native; otherwise both are converted with the base (the valuation base, else the user's base) and a conversion failure or a non-positive unit makes the entry unavailable.
- **ROI** = Σ tournament P/L ÷ Σ tournament buy-in × 100, over tournaments only; `null` when the denominator is 0 and in normalized mode.
- **ITM** is a tournament with a `prize` line; a bounty alone is not ITM.

## Time and rates

Time is summed per `play_session`: `(ended_at − started_at − 60 × break_minutes) / 3600` for each day that has both endpoints. A day missing either endpoint adds nothing, and time between days is never counted. An entry with no timed day has `playMinutes = null` and lands in the `unknown` length bucket.

`bbPerHour` divides the bb of cash entries whose days are all timed by those entries' hours, so an untimed entry's result is never spread over other entries' hours. `bb100` and `handsPerHour` are deferred to B24 (SA2-413); `handCount` is reported.

## EV

The EV figures come from `entry.ev_diff` on cash entries. They are `null` until an entry in scope recorded an EV difference whose asset fits the mode (native: the entry's table asset is the selected asset; valuation: the difference converts at the entry's last line time; normalized: the entry has a bb). Once one has, `evProfitLoss` spans every counted cash entry, an unrecorded one counting at its actual result, so it stays comparable with the cash P/L. A recorded difference of 0 is recorded; only `null` is missing.

## Breakdown and series

`stats.breakdown` partitions the population: every entry lands in exactly one group.

| `groupBy` | Key |
|---|---|
| `room` | room id, or `none` |
| `stakes` | `<gameGroupId>:<blind1>/<blind2>/<blind3>/<ante>/<anteType>`; a multi-group lineup is `multi-group`, every tournament is `tournament` |
| `kind` | `cash` / `tournament` |
| `dayOfWeek` | `0`–`6` (Sunday = 0) from `played_on` |
| `length` | `<1h`, `1-2h`, `2-4h`, `4-8h`, `8h+`, `unknown` |
| `month` / `year` | `YYYY-MM` / `YYYY` from `played_on` |
| `variant` | `mix:<gameMixId>`, `variant:<gameVariantId>`, or `custom` (rules follow [game-lineups.md](game-lineups.md)) |

`stats.profitLossSeries` returns one per-entry delta per settled entry ordered by `played_on`, then id. A point's `profitLoss` is in the mode's unit (`asset`, or `bb` / `bi` per kind in normalized mode) and is `null` when the entry was excluded. Both procedures return the same `coverage` as the summary.
