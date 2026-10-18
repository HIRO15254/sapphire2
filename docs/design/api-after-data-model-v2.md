# Final API after data model v2

Status: **design contract**, for the single v2 + new UI release. This is not a description of the currently deployed API. All tasks in [data-model-v2.md §17](data-model-v2.md#17-task-breakdown) must be complete. Releases remain frozen until that release; the old feature UI is removed by B03, not adapted to these contracts.

This document owns procedure names, request/response shapes and the MCP projection. [data-model-v2.md](data-model-v2.md) owns tables, invariants, calculations (§12), event projections (§13), migration and task order. [game-lineups.md](game-lineups.md) owns immutable lineups, rule versions, version-write semantics and the game/rule tasks (B05, B07, B08, B11, B13, B20). There is one API generation: removed names have no aliases. Historical findings live in SA2-334 and the spec's [§17.1 finding table](data-model-v2.md#171-finding-to-task-resolution), not here.

## 1. Conventions

### Authentication, identifiers and errors

Every procedure except root `healthCheck` is authenticated (`UNAUTHORIZED` otherwise). `Id` means a nonempty opaque string, never a label or a legacy session-id discriminator. Every supplied id, including nested arrays, price ids, linked hand ids and cursor scope, is ownership-checked. Missing and foreign ids uniformly return `FORBIDDEN`; `getById` does not expose existence through `NOT_FOUND`. Parent membership is checked in addition to ownership. User-scoped joins and chunked child hydration must not introduce an existence oracle or N+1 queries.

| Error | Contract |
| --- | --- |
| `BAD_REQUEST` | Invalid shape/order/time, wrong entry kind, mismatched stakes, duplicate members, newly selected archived master, same-asset exchange, editing event-derived fields manually. |
| `FORBIDDEN` | Missing/foreign entity or cursor scope; accessing a child outside its validated parent; editing entry money through wallet procedures. |
| `CONFLICT` | Unique-name/label collision, duplicate rate effective instant, reference-protected delete, second active/paused play session, unsafe undo, immutable referenced asset kind/decimals. Reference-protected master deletion explicitly recommends archive. |
| `PRECONDITION_FAILED` | Invalid lifecycle state (including append to an ended play or count add/undo outside active play); missing configured base asset for requested conversion; continuing an explicitly finished entry; rule operation requiring an absent linked master. |
| `INTERNAL_SERVER_ERROR` | Configured external service unavailable or malformed provider response; never an ownership substitute. |

Omitted update fields mean unchanged; `null` clears only nullable fields. Supplied arrays replace the entire collection, unless explicitly described otherwise. Validation applies to the resulting merged object on create **and** update. Unknown legacy fields are not given compatibility handlers or special strict-rejection code.

All multistatement writes, event changes plus projection, exchange pairs, rule writes, and replace-all child writes use one D1 `db.batch()`. Inserts respect the 100-bound-parameter limit. Event/hand sequence allocation occurs inside INSERT, not from an earlier application-side MAX. These are observable atomicity requirements, not optional implementation advice.

The D1 budget is Workers Paid's 1,000 queries per Worker invocation, including authentication/session reads and each batch statement (spec §20.1 item 10). B08 derives/enforces tournament levels × lineup groups/prices maxima, including createAndAssignTournament with B13's relink cost; B16 derives/enforces manual playSessions/payments maxima. They record the fixed bounds here and add a real D1 integration test counting statements at maximum input. No independent fixed array maximum overrides this budget.

### Dates, quantities, lists and common results

- `DateOnly` is a valid calendar string `'YYYY-MM-DD'`: `playedOn`, `localDate`, `dateFrom`, `dateTo`. Date filters are inclusive and use `played_on`; calendar axes do too.
- `Instant` input is an integer Unix **second**, not milliseconds or a date string. Timestamp output is a `Date` through tRPC's transformer and an ISO-8601 string in JSON/MCP. This includes ledger `occurredAt`, rate `effectiveFrom` and all event timestamps. Rate `effectiveFrom: 0` means effective from the beginning.
- Live local dates derive from `userSetting.timeZone`; null means `Asia/Tokyo`. An explicitly supplied local date is validated as a date-only value. Manual money timestamps follow the spec's manual-line rule, not the server's locale.
- Every written event time in playEvent.create/update and live.create/complete/endPlay/startNextPlay must be at most server now + 60 seconds; otherwise BAD_REQUEST. Check only the time being written, not unchanged existing rows; non-event payload clocks such as timerStartedAt are exempt (spec §13.2).
- Money quantities are integers in the asset's smallest unit; `asset.decimals` is 0–4. `Quantity` is 1–10^12. Payment inputs are unsigned; role determines the stored sign. Adjustment inputs are signed nonzero integers with absolute value at most 10^12. Chips, blinds, pots and counts are nonnegative integers, not converted asset amounts. Equity is a percentage in [0,100].
- `assetId` replaces `currencyId` everywhere. Every money line has its **own required assetId**. Entry/master default asset metadata never makes an omitted payment asset valid. Items/tickets use quantity units exactly like currency lines; they are not silently treated as currency.
- All paginated inputs use opaque **string keyset cursors** and all pages return `{ items: T[], nextCursor: string | null }`. Cursors contain the complete ordering tuple and filter/owner scope, survive deletion of the boundary row, and are not numeric hand numbers. Invalid encoding is `BAD_REQUEST`, invalid ownership is `FORBIDDEN`.
- `PageInput = { cursor?: string, limit?: integer }`; entry/live limits default 20, range 1–100; hand/player-hand default 20, range 1–50; ledger default 20, range 1–100. Entry/live order `(playedOn,id)` descending; hand `(handNo,id)` descending; ledger `(occurredAt,id)` descending. Series are chronological.
- Every archivable master list accepts `includeArchived?: boolean` (default false); true includes active **and** archived rows. Historical references always hydrate archived masters regardless of this flag. This applies to asset, room, ringGame, tournament, gameGroup, gameVariant, gameMix and ledgerCategory.
- `IdInput = { id: Id }`; `Ack = { success: true }`; `IdResult = { id: Id }`. Procedures returning a record return the complete documented record, not a database-only fragment. Common auth, ownership and input errors apply to every row below; the error column lists additional cases.
- `Q` / `M` in procedure tables mean query / mutation. `Excluded: cockpit`, `wallet`, `destructive`, `screen`, `duplicate read`, `toggle`, `extraction` and `external quota` are explicit MCP exclusion reasons, not unregistered procedures.

### Undo

All non-destructive mutations in the new UI show a toast while running and offer **Undo** for six seconds after success. Derive the inverse's previous values from the same client-cache snapshot used for optimistic-update rollback. Undo sends a compensating request; it is not a deferred write.

Do not offer Undo for an Undo (no redo), hard deletes (`*.delete`, `live.discard`), or non-persisting operations (`location`, `aiExtract`, `markViewed`). Hard deletes use only a confirmation Dialog, as required by `web-theme.md`; no API can restore them exactly (user decision, 2026-10-16).

Conflicts use last-writer-wins (R4), without optimistic concurrency control. If a documented error rejects the inverse, show **"Couldn't undo"** and leave state unchanged.

| Operation | Inverse |
| --- | --- |
| create | delete (`live.create` uses `live.discard`) |
| Partial update | update with previous values |
| Whole-array replacement | Replace with the previous array |
| archive | restore, and vice versa |
| toggleFavorite | toggleFavorite again |
| setDefault | Previous setDefault / clearDefault |
| reorder | Previous order |
| Rule operation | restoreRule |
| playEvent.create | playEvent.delete |
| tablePlayer operation | playEvent.delete with the returned eventId |
| hand.add | hand.undoLast |
| complete / endPlay | undoEndPlay |
| startNextPlay | undoStartNextPlay |
| Ledger creation | ledger.delete |

## 2. Shared response and input types

### Payments and entry money

```ts
type Payment = {
  assetId: Id;
  quantity: Quantity;
  role: EntryRole;
  effect?: 'real' | 'virtual'; // default real
  priceId?: Id;              // price of this entry's tournament rule
};
type EntryRole = 'buy_in' | 'reentry' | 'fee' | 'chip_purchase' | 'addon'
  | 'chip_remove' | 'cash_out' | 'prize' | 'bounty';
type Amounts = { buyIn: number; cashOut: number; profitLoss: number };
type MissingRate = { assetId: Id; earliestOccurredAt: Timestamp };
type EntryLine = {
  id: Id; entryId: Id; playSessionId: Id; eventId: Id | null;
  assetId: Id; role: EntryRole; effect: 'real' | 'virtual';
  quantity: number; occurredAt: Timestamp; priceId: Id | null;
};
type AssetTotal = Amounts & {
  assetId: Id; effect: 'real' | 'virtual';
  roleTotals: Partial<Record<EntryRole, { quantity: number; lineCount: number }>>;
};
type EntryMoney = {
  lines: EntryLine[];
  totals: AssetTotal[];
  valuation: {
    baseAssetId: Id | null;
    real: Amounts | null;
    virtual: Amounts | null;
    missingRates: { real: MissingRate[]; virtual: MissingRate[] };
  };
};
```

`lines` preserve signed quantities and line-level provenance; order `(occurredAt,id)` ascending. `totals` are exact native-asset sums, separately for each asset/effect, never a cross-asset number. Role totals expose prize versus bounty and chip-purchase/addon counts without storing a second count. `valuation` delegates to `valuation.ts` and spec §12: real and virtual are the service's two valuation modes, **not** two disjoint subtotals to add together. Missing conversion makes the affected valuation null, never zero; no configured base asset makes both null with `baseAssetId:null`. Native totals remain available. Entry reads use the user's configured base asset, not a hidden entry-level currency conversion.

Manual cash permits `buy_in, addon, chip_remove, cash_out`; tournament permits `buy_in, reentry, fee, chip_purchase, prize, bounty`. Start permits cash buy_in and tournament buy_in/fee; re-entry permits reentry/fee; complete permits cash cash_out and tournament prize/bounty; addon-kind tournament prices produce chip_purchase lines (plus fee when present), not cash addon lines. Real/virtual role restrictions are those of spec §7/§11. Prices never infer an asset omitted from a payment. Zero-cost attendance uses no money line, not a zero line.

### Play sessions and entry records

```ts
type EndState = 'bagged' | 'held' | 'busted' | 'cashed_out' | 'finished';
type ManualPlay = {
  id?: Id; // preserve an existing Day's identity on manual update (B16)
  localDate: DateOnly; label?: string; // label <= 50 chars
  startedAt?: Instant; endedAt?: Instant; breakMinutes?: number;
  endState: EndState; endStack?: number;
  payments: Payment[]; // associates every manual line with this play
};
type PlaySession = {
  id: Id; seq: number; label: string | null; localDate: DateOnly;
  startedAt: Timestamp | null; endedAt: Timestamp | null; breakMinutes: number;
  status: 'active' | 'paused' | 'ended'; endState: EndState | null;
  endStack: number | null; clockStartedAt: Timestamp | null;
  clockStartLevel: number | null;
};
type EntryOutput = EntryMoney & {
  id: Id; kind: 'cash' | 'tournament'; source: 'live' | 'manual' | 'import';
  status: 'open' | 'settled'; playedOn: DateOnly; title: string | null;
  roomId: Id | null; roomName: string | null; assetId: Id | null;
  memo: string | null; createdAt: Timestamp; updatedAt: Timestamp;
  playSessions: PlaySession[]; playMinutes: number; handCount: number;
  tags: { id: Id; name: string }[];
  ringGameId: Id | null; tournamentId: Id | null;
  ruleVersionId: Id; currentMasterRuleId: Id | null;
  ruleDrift: boolean; ruleVersion: CashRule | TournamentRule;
  lineups: LineupMap;
  cash: { evDiff: number | null; bigBlind: number | null } | null;
  tournament: {
    placement: number | null; totalEntries: number | null; beforeDeadline: boolean;
  } | null;
};
```

Kind-specific details are mutually exclusive. The tournament's `totalEntries` is field size; aggregate counts are always `entryCount`. `ruleDrift` is false without a linked master, otherwise `ruleVersionId !== currentMasterRuleId`, not a field comparison. Play sessions are seq ascending. Derived time, big blind, EV and settled status follow spec §12/§13, not legacy summary columns.

`ManualPlay` times must be ordered, break duration valid, and plays chronological/nonoverlapping. Earlier plays close held/bagged; the last closes in a settled end state valid for kind; held/bagged require endStack. Manual records may omit wall-clock times without fabricating duration. `playedOn` equals the minimum local date. Entry create accepts either one top-level `payments` array for a single play or payments inside `playSessions[]`; multi-play requests must use per-play payments, and simultaneous top-level/per-play money is `BAD_REQUEST`. This fixes attribution without an array-index foreign key or a second input generation.

On manual update, a supplied `ManualPlay.id` identifies an existing Day of that entry; preserve its id and attached hands rather than delete/recreate it. Omit id for a new Day. Ownership and parent-membership checks apply (B16).

### Games and immutable rule bodies

`GameInput = { variantId: Id } | { gameMixId: Id } | { lineupId: Id }`. A level's `game:null` means inherit. `StakeInput = { gameGroupId: Id, blind1?:number|null, blind2?:number|null, blind3?:number|null, ante?:number|null, anteType?:'none'|'all'|'bb'|null }`. Exactly one stake per effective lineup group in group order; mismatch is `BAD_REQUEST`. Stored lineup ids round-trip archived selections; newly picking archived masters is rejected. Omitted game inherits the linked master, otherwise builtin NLH. Omitted stakes carry by `(gameGroupId, occurrence within that structure)`, not absolute position.

For newly written stake rows, the server rejects a null/omitted blind marked Required by its game group, or a value in a blind field without a label (`BAD_REQUEST`, B11 / SA2-396). Ante is outside this requirement system. Reusing an existing immutable rule version does not revalidate its stakes. B07/B08's shared rule-write service enforces this, including writes through B13.

```ts
type CashRuleInput = {
  game?: GameInput; stakes?: StakeInput[];
  minBuyIn?: number | null; maxBuyIn?: number | null;
  tableSize?: number | null; houseRules?: string | null;
};
type PriceInput = {
  kind: 'entry' | 'reentry' | 'addon'; assetId: Id;
  amount: number; fee: number; chips: number | null; label?: string;
};
type LevelInput = {
  isBreak: boolean; minutes?: number | null;
  game?: GameInput | null; stakes?: StakeInput[];
};
type TournamentRuleInput = {
  game?: GameInput; startingStack?: number | null; bountyAmount?: number | null;
  tableSize?: number | null; houseRules?: string | null;
  levels?: LevelInput[]; prices?: PriceInput[];
};
```

Table size is 2–10; minBuyIn <= maxBuyIn. Level/group/price array maxima are derived from the invocation budget by B08 and recorded here when fixed; label maximum 100 characters; houseRules maximum 50,000. Price amount/fee/chips are nonnegative integers (amount/fee <=10^12); assetId is required even for a free price. A ticket price is an item asset, not a special branch. Breaks have no stakes/game override. Supplied levels/prices replace the **whole** collection; each structural edit writes one immutable version, never parallel per-row edits.

`LineupMap` maps lineup id to `{id,gameMixId,displayName,groups:[{id,gameGroupId,name,variants:[{id,label,shortLabel}]}]}`. `CashRule` is `{id,ringGameId,parentRuleId,lineupId,stakes,...cash scalar fields}`. `TournamentRule` is `{id,tournamentId,parentRuleId,lineupId,...tournament scalar fields,levels,prices}`. Output stake adds `lineupGroupId`; level adds `id,ordinal,level,effectiveLineupId` and returns `game:null` for inheritance; price adds `id,ordinal`. Ordinals derive from array order. Master ownership ids may be null only for standalone entry versions. Display names resolve current user-owned master labels, including archived rows; composition never changes retroactively.

## 3. `entry` — B16; rule operations B20; tags B18

| Procedure | Input (constraints) | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | PageInput; `kind?,status?:open|settled,roomId?,assetId?,dateFrom?,dateTo?` | Page<EntryOutput> | Date range reversed: BAD_REQUEST | `entry_list` |
| `getById` Q | IdInput | EntryOutput | — | `entry_get_by_id` |
| `create` M | Discriminator `kind:cash|tournament`; `playedOn:DateOnly`, `playSessions?:ManualPlay[]` (nonempty; days/payments maxima derived from the invocation budget by B16), `payments?:Payment[]` (single play), `roomId?,assetId?,title?:string<=100,memo?:string<=5000,tagIds?:Id[]`; cash: `ringGameId?,rule?:CashRuleInput,evDiff?:signed integer`; tournament: `tournamentId?,rule?:TournamentRuleInput,placement?:positive integer,totalEntries?:positive integer,beforeDeadline?:boolean=false` | EntryOutput, source manual | placement > totalEntries unless beforeDeadline; inconsistent playedOn/plays: BAD_REQUEST | `entry_create_cash`, `entry_create_tournament` |
| `update` M | `id`; mutable create fields optional; kind/source immutable; nullable metadata may clear; playSessions/payments/tagIds replace all when supplied | EntryOutput | Live event-derived fields (money, time, status, results, EV) cannot be patched: BAD_REQUEST | `entry_update` |
| `delete` M | IdInput | Ack | — | Excluded: destructive |
| `overrideRule` M (B20) | `{id,rule:CashRuleInput|TournamentRuleInput}` matched to kind | EntryOutput | Invalid stake coverage or live seat outside reduced tableSize: BAD_REQUEST | Excluded: rule workflow |
| `applyMasterRule` M (B20) | IdInput | EntryOutput | No linked master: PRECONDITION_FAILED | Excluded: rule workflow |
| `pushRuleToMaster` M (B20) | IdInput | EntryOutput | No linked master: PRECONDITION_FAILED | Excluded: rule workflow |
| `relink` M (B20) | `{id,ringGameId:Id|null,keepRule:boolean}` or tournament twin, matching kind | EntryOutput | Wrong-kind link: BAD_REQUEST | Excluded: rule workflow |
| `restoreRule` M (B20) | `{id,masterId:Id|null,ruleVersionId:Id,masterRuleVersionId?:Id}` | EntryOutput | Version not owned by the specified master (or not standalone when masterId is null), or masterRuleVersionId without a master: BAD_REQUEST | Excluded: screen |

List asset filtering means **has a ledger line in that asset**, not entry default asset equality. List has no ambiguous all-asset aggregate `summary`; use `stats` with an explicit mode. Open entries remain visible; statistics do not count them. Omitting playSessions on manual create synthesizes one ended play on playedOn; no legacy top-level startedAt/endedAt/breakMinutes fields. `beforeDeadline:true` stores placement null. Array tag ids are unique and owner-checked.

Rule operations are also present on live (§4), with the same semantics. Override inserts a child under the same master and changes only the entry; unchanged signature reuses the version. Apply points to the linked master's current version. Push points the master to the entry's same-master version (or creates an equal version under that master) and aligns both ids. Relink with keepRule false applies the destination's current version; true copies the entry version under the destination master, never points across masters. Unlink preserves content as a parentless standalone version. Ordinary `update` may change metadata, but changing an already-linked master must use `relink`, and subsequent rule edits use the named rule operations. No keepSnapshot flag remains.

`restoreRule` restores the entry's master link and existing rule version in one batch; when supplied, `masterRuleVersionId` also restores that master's current version in the same batch. Every version must belong to that master; with `masterId:null`, the entry version must be standalone. No new version is created. Archived masters and versions are allowed because this only restores saved values. Live entries also apply the tableSize/active player and self-seat validation. This is the inverse of overrideRule, applyMasterRule, pushRuleToMaster and relink; to undo createAndAssign*, follow restoreRule with deletion of the created master.

Payments may reference only existing prices in the selected immutable tournament version. To create a new price and pay it, first write the rule through a rule operation/master operation, read the returned price id, then record the payment. Manual payments may omit priceId; no guessed price-id mapping or temporary client id is accepted. Changing a rule version with existing priced lines preserves those references to their original price; new payments use the new version's price ids.

## 4. `live` — B17, B19; rule operations B20

All reads and successful entry mutations return EntryOutput, never game_session/sessionDate/completed/evCashOut output. Live tournament records additionally return `progress:{currentStack:number|null,remainingPlayers:number|null,totalEntries:number|null,chipTotal:number,averageStack:number|null}`. The server fold and formula are owned by spec §13.2 and checked by A-6; charts consume these values without recomputing them. `getById` additionally returns `{events:PlayEvent[],currentPlaySessionId:Id|null,currentButtonSeat:number|null}`. All procedures are **Excluded: cockpit** in MCP, including reads and rule operations, except `restoreRule` (**Excluded: screen**).

| Procedure | Input | Output | Additional errors / task |
| --- | --- | --- | --- |
| `list` Q | Entry list filters + PageInput; source is live | Page<EntryOutput> | B17 |
| `getById` Q | IdInput | EntryOutput + live detail above | Non-live target: BAD_REQUEST; B17 |
| `create` M | `kind:cash|tournament,roomId?,assetId?,memo?,startedAt?:Instant,localDate?:DateOnly,label?:string<=50,payments:Payment[]`; matching `ringGameId?`/`tournamentId?`, `rule?`; tournament `initialStack?:nonnegative integer,timerStartedAt?:Instant,startLevel?:positive integer` | EntryOutput + tournament progress | Existing active/paused play: CONFLICT; initialStack writes the first update_stack in the creation batch; B17 |
| `createAndAssignRingGame` M | `{entryId,...ringGame.create input}` | EntryOutput | Cash only; create and relink one batch; B17/B20 |
| `createAndAssignTournament` M | `{entryId,...tournament.createWithLevels input}` | EntryOutput | Tournament only; one batch; B17/B20 |
| `update` M | `{id,memo?:string|null,roomId?:Id|null,assetId?:Id|null}` | EntryOutput | Derived fields cannot be patched; B17 |
| `complete` M | `{id,occurredAt?:Instant,endState:cashed_out|busted|finished,payments:Payment[],beforeDeadline?:boolean,placement?:positive integer,totalEntries?:positive integer}` | EntryOutput | Terminal time earlier than an existing event of this play or beyond now+60s: BAD_REQUEST before writes; active/paused play required; B17 |
| `endPlay` M | `{id,occurredAt?:Instant,endState:held|bagged,stackAmount:nonnegative integer}` | EntryOutput | held cash only, bagged tournament only; terminal time earlier than an existing event of this play or beyond now+60s: BAD_REQUEST before writes; B19 |
| `startNextPlay` M | `{id,startedAt?:Instant,localDate?:DateOnly,label?:string<=50,startLevel?:positive integer,payments?:Payment[]}` | EntryOutput | No ended predecessor or finished: PRECONDITION_FAILED; competing active play: CONFLICT; B19 |
| `undoEndPlay` M | IdInput | EntryOutput | Highest-seq play must end with its terminal event and have no later dependent event: CONFLICT; B19 |
| `undoStartNextPlay` M | IdInput | EntryOutput | Highest seq must be >1 and contain only its start event, no hands/other descendants: CONFLICT; B19 |
| `discard` M | IdInput | Ack | Settled target: BAD_REQUEST; B17 |
| `overrideRule` M | Same as entry.overrideRule | EntryOutput | Reduced tableSize excludes active player/self seat: BAD_REQUEST; B20 |
| `applyMasterRule` M | IdInput | EntryOutput | Reduced tableSize excludes active player/self seat: BAD_REQUEST; B20 |
| `pushRuleToMaster` M | IdInput | EntryOutput | B20 |
| `relink` M | Same as entry.relink | EntryOutput | Reduced tableSize excludes active player/self seat: BAD_REQUEST; B20 |
| `restoreRule` M | `{id,masterId:Id|null,ruleVersionId:Id,masterRuleVersionId?:Id}`; same atomic restore and version-membership rules as entry.restoreRule | EntryOutput | Wrong-master/non-standalone version or masterRuleVersionId without a master: BAD_REQUEST; reduced tableSize excludes active player/self seat: BAD_REQUEST; archived masters/versions allowed; B20; MCP Excluded: screen |

EndPlay writes day_end, leaving entry open; complete writes session_end. State is taken from play_session.status, so no ordinary append can revive an ended play. Next-play after held/bagged continues; after tournament busted it re-enters; after finished it fails. Cash cashed_out requires explicit undo/correction before continuation, as specified in spec §13.3; startNextPlay never silently rewrites a receipt or terminal event. Re-entry payments are embedded in the new session_start and written in that **same batch**, not a second API call/event; allowed only for tournament re-entry, roles reentry/fee. Seat state carries forward. `undoEndPlay` removes the terminal event and reprojects to active (the global active-play guard still applies). `undoStartNextPlay` removes that empty last play plus its start/payment projection. These are the only lifecycle undo procedures; there is no reopen.

## 5. `playEvent` — B17, B15; all-in hand link B21

`PlayEvent = {id,entryId,playSessionId,eventType,occurredAt,sortOrder,payload,schemaVersion:2,createdAt,updatedAt}`. Payload is a validated **object**, never serialized JSON. Writers explicitly set schema version 2; there is no caller version/default 1 or v1 reader after B15. Event ids are the only event identity. All procedures are **Excluded: cockpit**.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | `{entryId,playSessionId?:Id}` | PlayEvent[] ordered `(occurredAt,sortOrder,id)` ascending | — |
| `create` M | `{entryId,playSessionId?:Id,eventType,occurredAt?:Instant,payload}` discriminated by type | PlayEvent | No active/paused target or ended target: PRECONDITION_FAILED |
| `update` M | `{id,occurredAt?:Instant,payload?:matching payload}`; type immutable | PlayEvent | Lifecycle changes outside live operations: BAD_REQUEST |
| `delete` M | IdInput | Ack | Lifecycle event: BAD_REQUEST; use named live undo. Participation/seat event in an ended Day or with subsequent events: CONFLICT (unsafe undo) |

Omitted playSessionId selects the non-ended play only; it never falls back to an ended latest play. Ordinary event edits/deletes must leave the complete ordered stream valid and atomically reproject. Ended-play historical ordinary-event corrections are allowed only if the final lifecycle remains ended; new appends to it are not. Kind and state validation use spec §13.

`playEvent.delete` can undo a tablePlayer operation by its returned eventId only while it is that player's latest participation/seat event, the Day is non-ended, and no subsequent event exists; otherwise `CONFLICT` (unsafe undo, B17).

| eventType | Payload object | User create/update/delete |
| --- | --- | --- |
| session_start | `{payments:Payment[],timerStartedAt?:Instant,startLevel?:number}` | Live lifecycle only |
| session_end | `{endState,payments:Payment[],beforeDeadline?,placement?,totalEntries?}` | Live lifecycle only |
| day_end | `{endState:held|bagged,stackAmount:number}` | Live lifecycle only |
| reentry | `{payments:Payment[]}` | Active tournament only; same-day re-entry; terminal-play continuation uses startNextPlay |
| table_change | `{tableLabel?:string,seatPosition?:integer 0..9}` | Yes |
| session_pause / session_resume | `{}` | Yes; matching active/paused transition |
| chips_add_remove | `{amount:signed nonzero integer,assetId:Id,effect?:real|virtual}` | Cash only; explicit asset |
| all_in | `{potSize:nonnegative integer,trials:positive integer,equity:number 0..100,wins:number 0..trials,handId?:Id}` | Cash only; fractional wins represent chopped pots; hand must belong to same playSessionId |
| purchase_chips | `{priceId:Id,payments:Payment[]}` | Tournament only; server resolves immutable label/chips from price |
| update_stack | `{stackAmount:nonnegative integer,remainingPlayers?:positive integer|null,totalEntries?:positive integer|null,chipPurchaseCounts?:{name:string,count:nonnegative integer,chipsPerUnit:nonnegative integer}[]}` | Yes; explicit null clears field size/progress, omission keeps it; cumulative chip counts are progress-only, not payments (spec §13.2) |
| player_join | `{playerId:Id,seatPosition?:integer 0..9}` | Via tablePlayer operations |
| player_leave | `{playerId:Id}` | Via tablePlayer operations |
| memo | `{text:string<=5000}` | Yes |

Price links and self-player ids in migrated payloads are resolved by B15 from their actual stored relationships (price from that event's ledger line), not synthesized old ids. Every append, including memo/seats, writes version 2. Output/event snapshots use the same schemas as writers.

## 6. `tablePlayer` — B17, B15

Event-derived membership, not a second table. `TablePlayer = {id,player:Player,isActive:boolean,joinedAt:Timestamp,leftAt:Timestamp|null,seatPosition:number|null,stints:{joinedAt,leftAt,seatPosition}[]}`. All mutations require a non-ended play and emit player events in the same projection batch. All procedures are **Excluded: cockpit**.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | `{entryId,activeOnly?:boolean=false}` | `{items:TablePlayer[]}` | — |
| `add` M | `{entryId,playerId,seatPosition?:integer 0..9}` | `{id,playerId,eventId:Id}` | Duplicate active membership/seat: CONFLICT |
| `addNew` M | `{entryId,playerName:string 1..100,playerMemo?:string<=50000,playerTagIds?:Id[],seatPosition?:integer 0..9}` | `{id,playerId,eventId:Id}` | — |
| `addTemporary` M | `{entryId,seatPosition?:integer 0..9}` | `{id,playerId,eventId:Id}` | — |
| `updateSeat` M | `{entryId,playerId,seatPosition:integer 0..9|null}` | `{id,playerId,eventId:Id}` | Occupied seat: CONFLICT |
| `remove` M | `{entryId,playerId}` | `{id,playerId,eventId:Id}` | — |

Every mutation returns the emitted event's `eventId` (B17). Undo deletes it through `playEvent.delete`; only that player's latest participation/seat event is eligible. An ended Day or subsequent events make deletion unsafe (`CONFLICT`), with no partial state change.

Hero is the user's single `player.isSelf:true` row (B15), returned here like any other seated player and obtained with player.getSelf. `isHero` is derived from that identity, never independently editable. Hero joins/moves/leaves through these same procedures; no updateHeroSeat or separate hero-seat storage survives. Regular player lists, opponent statistics and new-opponent pickers exclude self.

## 7. `hand` — B10; detail writes B21; tags B18

`Hand = {id,playSessionId,handNo,playedAt,detail:count|summary|full,buttonSeat,tableSize,levelOrdinal,stakes,variantId,pot,rake,memo,boards:string[],tags,createdAt,updatedAt}`. Nullable scalar fields are explicit null. `Seat = {seat,playerId,isHero,startStack,holeCards,net,showed}`; `Action = {seq,street,seat,action,amount,allIn}`. Net is signed; other chip amounts nonnegative. isHero is output-derived from the self player, not a conflicting identity input.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{playSessionId,...PageInput}` (max 50) | Page<Hand & {seats:Seat[]}> | — | `hand_list` |
| `getById` Q | IdInput | Hand & `{seats:Seat[],actions:Action[]}` | — | `hand_get_by_id` |
| `add` M | `{playSessionId,buttonSeat?:0..9,tableSize?:2..10,levelOrdinal?:positive integer,stakes?,variantId?:Id,playedAt?:Instant}` | Hand | Play must be active (not paused/ended): PRECONDITION_FAILED | Excluded: cockpit |
| `undoLast` M | `{playSessionId}` | Ack | Not active: PRECONDITION_FAILED; last hand not count or linked all-in: CONFLICT | Excluded: cockpit |
| `update` M (B21) | `{id,detail:count|summary|full,tagIds?:Id[],...detail body}` | Hand & `{seats,actions}` | Invalid seats/actions/cards: BAD_REQUEST | Excluded: cockpit |
| `delete` M | IdInput | Ack | Linked all-in: CONFLICT | Excluded: destructive |

Count has no child details. Summary body has `boards` (0–4 boards, up to 5 cards each), `pot?,rake?,memo?:string<=2000,hero?:{playerId,startStack?,holeCards?,net?,showed?}`; hero.playerId must be self. Full has those shared fields plus `seats` (1–10) and `actions` (0–200). Seats/actions/boards are replaced in full in one batch; lowering detail deletes obsolete detail children. Cards match `[2-9TJQKA][shdc]`, separated by spaces (up to seven hole cards), with no duplicate within one board or seat. Seats are unique 0–9, actions refer to present seats, at most one self seat; showed requires hole cards, and show action requires showed. Action enum: post,straddle,bring_in,fold,check,call,bet,raise,draw,show,muck. Street is an integer 0–7, preserving the shared hand action schema's game-independent street ordinal. Deletion compacts handNo; button is derived from the highest remaining hand. Detail review/edit may occur after play ends; only count add/undo is active-only. All-in linking is playEvent payload.handId, never an independent cross-session link mutation.

## 8. `asset` — B12 (DDL B02; balances B09)

`Asset = {id,name,unit,description,kind:currency|item,decimals,archivedAt,isFavorite,balance,createdAt,updatedAt}`. Balance is signed native quantity per spec §12.4, including real entry and wallet lines; for an item the same field is holdings. A buy-in reduces it immediately even while the entry is open. Virtual lines never change balance.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | Asset[] | — | `asset_list` |
| `getById` Q | IdInput | Asset | — | Excluded: duplicate read |
| `create` M | `{name:string 1..100,unit?:string<=20,description?:string,kind:currency|item,decimals?:integer 0..4=0}` | Asset | Case-insensitive trimmed name collision: CONFLICT | Excluded: wallet |
| `update` M | `{id,name?,unit?:string<=20|null,description?:string|null,kind?,decimals?}` | Asset | kind or decimals change when referenced anywhere: CONFLICT | Excluded: wallet |
| `archive` M | IdInput | Asset | — | Excluded: wallet |
| `restore` M | IdInput | Asset | — | Excluded: wallet |
| `delete` M | IdInput | Ack | Any ledger/rate/entry/master-default/price/setting reference: CONFLICT, message "Asset is in use; archive it instead" | Excluded: destructive |
| `toggleFavorite` M | IdInput | Asset | — | Excluded: toggle |

Archived assets retain references, rates and balances. New selections must be active; unchanged historical references remain readable/editable. No special Unassigned asset behavior survives B23.

## 9. `assetRate` — B12

`Rate = {id,baseAssetId,quoteAssetId,rateNum,rateDen,effectiveFrom,memo,createdAt}`. Directed rate is quote smallest units per base smallest unit, represented by a positive rational; asset decimals are not silently applied a second time. Conversion resolution and rounding are exclusively spec §12 / valuation.ts.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{baseAssetId?:Id,quoteAssetId?:Id,effectiveAt?:Instant}` | Rate[], pair then effectiveFrom descending | — | `asset_rate_list` |
| `create` M | `{baseAssetId,quoteAssetId,rateNum:integer 1..10^12,rateDen:integer 1..10^12,effectiveFrom:Instant>=0,memo?:string}` | Rate | Same asset: BAD_REQUEST; same directed pair/effectiveFrom: CONFLICT | Excluded: wallet |
| `delete` M | IdInput | Ack | — | Excluded: destructive |

Without effectiveAt, list returns matching history. With it, returns only latest `effectiveFrom <= effectiveAt` per directed pair (not synthesized reciprocal/two-hop rates). Rates are immutable; correction deletes then creates. Base/quote naming here does not require an item to be a currency; userSetting's reporting base does.

## 10. `userSetting` — B12

`Setting = {baseAssetId:Id|null,timeZone:string|null}`. Null zone means Asia/Tokyo; null base means conversion has not been configured.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `get` Q | none | Setting (defaults even without a stored row) | — | `user_setting_get` |
| `update` M | `{baseAssetId?:Id|null,timeZone?:IANA time zone|null}` | Setting | Non-currency base or invalid zone: BAD_REQUEST | Excluded: screen settings |

## 11. `ledger` — B14; entry-line ownership B09

All procedures are **Excluded: wallet** (delete additionally destructive). Wallet writes cannot mutate projected or manual entry lines: `FORBIDDEN`, regardless of the line's owner. Entry money is changed only through entry/live.

`WalletLine = {id,assetId,role:adjustment|exchange,quantity,effect:real,categoryId:null|Id,entryId:null,transferId:null|Id,occurredAt,memo}`. History items are `{kind:wallet,line:WalletLine}` or `{kind:entry,id,entryId,title,assetId,quantity,occurredAt}`; the latter sums real lines for that entry/asset and uses their earliest timestamp. Virtual entry lines do not masquerade as wallet balance movements.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `listByAsset` Q | `{assetId,...PageInput}` | Page<HistoryItem> | — |
| `createAdjustment` M | `{assetId,quantity:signed nonzero integer,categoryId?:Id,occurredAt:Instant,memo?:string}` | WalletLine | Archived new category/asset selection: BAD_REQUEST |
| `createExchange` M | `{from:{assetId,quantity:Quantity},to:{assetId,quantity:Quantity},occurredAt:Instant,categoryId?:Id,memo?:string}` | `{transferId,lines:[WalletLine,WalletLine]}` | Same asset: BAD_REQUEST |
| `update` M | `{id,occurredAt?:Instant,memo?:string|null,categoryId?:Id|null,quantity?:signed nonzero integer}` | `{lines:WalletLine[]}` | Entry line: FORBIDDEN; changing exchange sign: BAD_REQUEST |
| `delete` M | IdInput | Ack | Entry line: FORBIDDEN |

Exchange atomically writes negative from and positive to with one transferId. Editing time/memo/category changes both rows; quantity changes only selected leg and preserves its sign. Delete removes both legs. No automatic equal-value/rate assumption is imposed on the user's entered exchange quantities.

## 12. `ledgerCategory` — B14 (backfill B09, DDL B01)

`Category = {id,name,archivedAt,createdAt,updatedAt}`. Names are trimmed, case-insensitively unique per user including archived rows. No reserved Session Result category or DEFAULT_TRANSACTION_TYPES behavior remains.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | Category[] | — | Excluded: wallet |
| `create` M | `{name:string 1..100}` | Category | Duplicate: CONFLICT | Excluded: wallet |
| `update` M | `{id,name:string 1..100}` | Category | Duplicate: CONFLICT | Excluded: wallet |
| `archive` M | IdInput | Category | — | Excluded: wallet |
| `restore` M | IdInput | Category | — | Excluded: wallet |
| `delete` M | IdInput | Ack | Referenced: CONFLICT, archive instead | Excluded: destructive |

## 13. `stats` — B22; hand rates B24

Only **settled entries** contribute to every stats procedure, including series, count, win/ITM/ROI and durations. Time, BI, ROI, EV, BB, hand eligibility and rounding follow spec §12 rather than a second set of API formulas. ROI is tournament-only; 1 BI excludes re-entry payments. Calendar grouping uses playedOn; duration sums each play separately, never an entry-spanning wall-clock interval.

Exactly one mode is required:

| Mode input | Meaning / output unit |
| --- | --- |
| `{assetId:Id}` | Native single-asset lines only. No conversion. Entries with this asset plus others are included, not silently zeroed. |
| `{valuation:'real'|'virtual',baseAssetId?:Id}` | Converted mode; base defaults to userSetting.baseAssetId and must be currency. Missing configured base: PRECONDITION_FAILED. |
| `{normalized:true}` | Currency-independent BB for cash and BI for tournaments; separate outputs/series, never a BB+BI total. No raw cross-asset amount/ROI is fabricated. |

Supplying conflicting mode fields is BAD_REQUEST; normalized:false is absence, not another mode. Common filters: `{kind?:cash|tournament,roomId?:Id,dateFrom?:DateOnly,dateTo?:DateOnly,entryTagIds?:Id[],tournamentTagIds?:Id[]}`. Within a tag kind, ids mean any matching tag; across kinds filters intersect. Tournament-tag filtering selects entries linked to tagged tournament masters. Id arrays are unique and validated. Tag ownership failures are FORBIDDEN.

`Coverage = {entryCount,excludedEntryCount,missingRates:MissingRate[],multiAssetEntryCount,otherAssetIds:Id[],unavailableNormalizationEntryCount}`. entryCount counts the settled population before missing-rate/denominator exclusions; excludedEntryCount reports entries excluded from a selected valuation. Native mode reports the other assets and multi-asset entry count, making partial-asset P/L explicit. No native total claims to be whole-entry P/L when another asset exists.

`Metrics = {winCount,lossCount,winRate,playMinutes,handCount,handsPerHour,cashEntryCount,tournamentEntryCount,itmCount,itmRate,averagePlacement,roi,bb100,bbPerHour,evRecordedEntryCount,evDiff,evProfitLoss}`. Undefined ratios/EV are null, not zero. Monetary fields in normalized mode are null; `normalized:{cash:{unit:'bb',entryCount,profitLoss,evProfitLoss}|null,tournament:{unit:'bi',entryCount,profitLoss}|null}` carries the dimensionless alternatives. Other modes return `amounts:Amounts` in the selected asset/base and `normalized:null`. Coverage reports exclusions for each normalized branch as well as overall.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `summary` Q | Mode + common filters | `{mode,assetId:Id|null,valuation:real|virtual|null,...Coverage,...Metrics,amounts:Amounts|null,normalized}` | Invalid mode/date range: BAD_REQUEST | `stats_summary` |
| `breakdown` Q | Summary input + `groupBy:room|stakes|kind|dayOfWeek|length|month|year|variant` | `{groups:[{key:string,label:string,...summary fields}],coverage:Coverage}` | — | `stats_breakdown` |
| `profitLossSeries` Q | Summary input | `{points:[{id,kind,playedOn,profitLoss:number|null,evProfitLoss:number|null,evRecorded:boolean,playMinutes,bigBlind:number|null,buyInTotal:number|null,unit:asset|bb|bi}],coverage:Coverage}` | — | `stats_profit_loss_series` |

Points are per-entry **deltas**, not running totals, ordered `(playedOn,id)` ascending. `buyInTotal` is the spec's normalization denominator, not all re-entry costs. Variant keys are `mix:<id>`, `variant:<id>`, or `custom`; labels resolve current masters. Stakes keys derive game-group ids and native stake values; multi-group lineups receive an explicit multi-group bucket, never "0/0". Room keys are ids (null room is `none`). Date buckets use ISO dates/month/year and weekday 0–6; length buckets are `<1h`, `1-2h`, `2-4h`, `4-8h`, `8h+`, `unknown`. Unknown/noneligible dimensions are explicit groups rather than silent missing totals; unavailable BB still cannot contribute to BB rates. Mixed cash/tournament normalized series have distinct units on every point.

## 14. `ringGame` — B07; archive T01; MCP schema B07

`RingGame = {id,roomId,name,defaultAssetId:Id|null,memo,archivedAt,currentRuleId,ruleVersion:CashRule,lineups:LineupMap,createdAt,updatedAt}`. Rule fields belong to ruleVersion, not duplicated top-level columns. Referenced masters cannot be hard-deleted; archive is reversible.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `listByRoom` Q | `{roomId,includeArchived?:boolean}` | RingGame[] | — | `ring_game_list_by_room` |
| `create` M | `{roomId,name:string 1..100,defaultAssetId?:Id,memo?:string,rule:CashRuleInput}` | RingGame | Invalid range/structure: BAD_REQUEST | `ring_game_create` |
| `update` M | `{id,name?,defaultAssetId?:Id|null,memo?:string|null,rule?:CashRuleInput}` | RingGame | Invalid resulting range: BAD_REQUEST | `ring_game_update` |
| `restoreRule` M (B07) | `{id,ruleVersionId:Id}` | RingGame | Version must belong to this master: BAD_REQUEST; archived master/version allowed | Excluded: screen |
| `archive` M | IdInput | RingGame | — | `ring_game_archive` |
| `restore` M | IdInput | RingGame | — | `ring_game_restore` |
| `delete` M | IdInput | Ack | Entry links or version use: CONFLICT, archive instead | Excluded: destructive |

`ringGame.restoreRule` points currentRuleId to an existing version of that master without creating a version, even when archived. It is the inverse of `update{rule}`.

## 15. `tournament` — B08; tags B18

`Tournament = {id,roomId,name,defaultAssetId:Id|null,memo,archivedAt,currentRuleId,ruleVersion:TournamentRule,lineups:LineupMap,tags:{id,name}[],createdAt,updatedAt}`. Get/list both return the complete version, levels and prices; no separate chip-purchase read is needed.

`TournamentCreate = {roomId,name:string 1..100,defaultAssetId?:Id,memo?:string,tagIds?:Id[],rule:TournamentRuleInput}`. `TournamentUpdate = {id,name?,defaultAssetId?:Id|null,memo?:string|null,tagIds?:Id[],rule?:TournamentRuleInput}`. Tags are ids, not names. Structures and prices are whole-version writes; omitted collections carry forward on update. `updateWithLevels` requires `rule.levels` and replaces it as a whole, while prices change only when supplied. Ticket, entry, reentry and addon price definitions all use the same prices array.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `listByRoom` Q | `{roomId,includeArchived?:boolean}` | Tournament[] | — | `tournament_list_by_room` |
| `getById` Q | IdInput | Tournament | — | `tournament_get_by_id` |
| `create` M | TournamentCreate | Tournament | Invalid structure/price: BAD_REQUEST | Excluded: narrower structure workflow |
| `update` M | TournamentUpdate | Tournament | Invalid merged rule: BAD_REQUEST | Excluded: narrower structure workflow |
| `createWithLevels` M | TournamentCreate with `rule.levels` required (may be empty) | Tournament | Invalid structure/price: BAD_REQUEST | `tournament_create_with_levels` |
| `updateWithLevels` M | TournamentUpdate with `rule.levels` required | Tournament | Invalid merged rule: BAD_REQUEST | `tournament_update_with_levels` |
| `restoreRule` M (B08) | `{id,ruleVersionId:Id}` | Tournament | Version must belong to this master: BAD_REQUEST; archived master/version allowed | Excluded: screen |
| `archive` M | IdInput | Tournament | — | `tournament_archive` |
| `restore` M | IdInput | Tournament | — | `tournament_restore` |
| `delete` M | IdInput | Ack | Entry links/version/price use: CONFLICT, archive instead | Excluded: destructive |

`create/update` are metadata/default-rule convenience procedures, not aliases; structural level replacement is the WithLevels workflow. Every call writes at most one resulting immutable rule version. Row-level blindLevel and tournamentChipPurchase routers are deleted, not wrapped.

`tournament.restoreRule` points currentRuleId to an existing version of that master without creating a version, even when archived. It is the inverse of `update{rule}` / `updateWithLevels{rule}`.

## 16. `gameGroup` — B05; required blinds B11 (SA2-396)

`GameGroup = {id,label,blind1Label,blind2Label,blind3Label,blind1Required:boolean,blind2Required:boolean,blind3Required:boolean,builtinKey,archivedAt,createdAt,updatedAt}`. Label trimmed 1–30 characters; blind labels nullable, trimmed 1–20. Case-insensitive trimmed label uniqueness is within this master kind, enforced without triggers. Archived rows keep their label reservation.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | GameGroup[] | — | `game_group_list` |
| `create` M | `{label,blind1Label?,blind2Label?,blind3Label?,blind1Required?:boolean=false,blind2Required?:boolean=false,blind3Required?:boolean=false}` | GameGroup | Duplicate: CONFLICT; Required field without a label: BAD_REQUEST | `game_group_create` |
| `update` M | `{id,label?,blind1Label?:string|null,blind2Label?:string|null,blind3Label?:string|null,blind1Required?:boolean,blind2Required?:boolean,blind3Required?:boolean}` | GameGroup | Duplicate or clearing a label with stored stake values: CONFLICT; Required field without a label: BAD_REQUEST | `game_group_update` |
| `archive` M | IdInput | GameGroup | Active variants using group: CONFLICT | `game_group_archive` |
| `restore` M | IdInput | GameGroup | — | `game_group_restore` |
| `delete` M | IdInput | Ack | Variants or lineup groups reference it: CONFLICT, archive instead | Excluded: destructive |

Only labeled blind fields may be Required; validate the merged group on create/update (`BAD_REQUEST`). User-created groups default all three flags to false (Optional). Clearing a blind label while any saved stake still has a value in that field is `CONFLICT`. Stake writes follow §2; existing version reuse is exempt, not newly written rows. Ante is unaffected.

Builtin defaults: Limit requires Small Bet and Big Bet; Stud requires Small Bet and Big Bet, with Bring-in Optional. Big Bet has only SB and BB, both Required: the Straddle field is removed. B11 adds the required flags, sets these builtin defaults, and clears Big Bet's former Straddle label; its migration aborts if any Big Bet stake has a blind3 value.

## 17. `gameVariant` — B05

`GameVariant = {id,label,shortLabel,groupId,builtinKey,sortOrder,archivedAt,createdAt,updatedAt}`. Label 1–30 trimmed; shortLabel nullable 1–15 trimmed. Moving a variant's group changes future lineups only; immutable historical lineup groups retain their structure. Renaming changes current display labels, not composition ids.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | GameVariant[] | — | `game_variant_list` |
| `create` M | `{label,shortLabel?,groupId}` | GameVariant | Duplicate within variant namespace: CONFLICT; a mix may share the label | `game_variant_create` |
| `update` M | `{id,label?,shortLabel?:string|null,groupId?,sortOrder?:nonnegative integer}` | GameVariant | Duplicate: CONFLICT; archived new group: BAD_REQUEST | `game_variant_update` |
| `archive` M | IdInput | GameVariant | Used by active mix: CONFLICT | `game_variant_archive` |
| `restore` M | IdInput | GameVariant | Archived group: BAD_REQUEST | `game_variant_restore` |
| `delete` M | IdInput | Ack | Referenced anywhere: CONFLICT, archive instead | Excluded: destructive |

## 18. `gameMix` — B05

`GameMix = {id,label,builtinKey,archivedAt,games:Id[],createdAt,updatedAt}` with variant ids in rotation order. Labels 1–30 trimmed; the label namespace guard is defined by spec §5.2 and A-14. Games: 2–30 unique owned ids. Restoring a label collision is never an implicit rename.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | GameMix[] | — | `game_mix_list` |
| `create` M | `{label,games:Id[]}` | GameMix | Duplicate label: CONFLICT; archived/duplicate members: BAD_REQUEST | `game_mix_create` |
| `update` M | `{id,label?,games?:Id[]}` | GameMix | Same; supplied games replaces complete rotation | `game_mix_update` |
| `archive` M | IdInput | GameMix | — | `game_mix_archive` |
| `restore` M | IdInput | GameMix | Archived member: BAD_REQUEST | `game_mix_restore` |
| `delete` M | IdInput | Ack | Referenced by lineup: CONFLICT, archive instead | Excluded: destructive |

B05 retains guarded hard delete only for unreferenced game masters, alongside archive/restore; no MCP delete is exposed. New selections reject archived composition members; echoing an unchanged stored lineup keeps history valid.

## 19. `entryTag` — B18

Created by `createTagRouter()`. `Tag = {id,name,position,createdAt,updatedAt}`; names trimmed 1–50, case-insensitively unique within user/kind. Common tag procedures below are instantiated per router; no cross-kind id is valid.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | none | Tag[] ordered position,id | — | `entry_tag_list` |
| `create` M | `{name:string 1..50}` | Tag | Duplicate: CONFLICT | `entry_tag_create` |
| `update` M | `{id,name:string 1..50}` | Tag | Duplicate: CONFLICT | Excluded: tag maintenance |
| `delete` M | IdInput | Ack; removes links, not entries | — | Excluded: destructive |
| `reorder` M | `{ids:Id[]}` unique complete permutation of owned tags of this kind | Tag[] | Incomplete/duplicate permutation: BAD_REQUEST | Excluded: screen ordering |

Entry attachment is entry.create/update tagIds; no separate toggle/addTag/removeTag procedures.

## 20. `tournamentTag` — B18

Same Tag shape and all five procedures/inputs/errors as §19, instantiated as `tournamentTag.list/create/update/delete/reorder`. Outputs respectively Tag[], Tag, Tag, Ack, Tag[]. MCP `tournament_tag_list`, `tournament_tag_create`; update/reorder excluded tag maintenance/screen ordering, delete excluded destructive. Attachment is tournament create/update/WithLevels tagIds, complete replacement. No name-based attachment.

## 21. `handTag` — B18

Same five Tag procedures, shapes, constraints and errors as §19, instantiated as `handTag.list/create/update/delete/reorder`. MCP `hand_tag_list`, `hand_tag_create`; update/reorder excluded tag maintenance/screen ordering, delete excluded destructive. hand.update accepts `tagIds` for attachment and `tagReviews?:{tagId:Id,reviewedAt:Instant|null}[]`; reviews must name attached owned tags, otherwise BAD_REQUEST. Link `reviewedAt` is returned in hand.tags as `{id,name,reviewedAt}` and does not mutate the tag itself.

## 22. `playerTag` — B18

Same five procedures as §19, instantiated as `playerTag.list/create/update/delete/reorder`. `PlayerTag = Tag & {color:TagColor}`. Create additionally accepts `color?:TagColor='gray'`; update accepts optional name/color, at least one. TagColor is the shared `TAG_COLOR_NAMES` enum, not arbitrary CSS. Outputs use PlayerTag instead of Tag. MCP `player_tag_list`, `player_tag_create`; update/reorder excluded maintenance/ordering, delete excluded destructive. Player create/update tagIds order defines link position; deleting a tag deletes links, not players.

## 23. `player` — existing surface; protection B10, self B15, opponent detail B24

`Player = {id,name,memo,isTemporary,isSelf,createdAt,updatedAt,tags:{id,name,color}[]}`. Names 1–100; memo <=50,000. isSelf/isTemporary cannot be supplied to ordinary create/update. Self exists exactly once per user and cannot be deleted; tablePlayer.addTemporary owns temporary creation.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{search?:string,tagIds?:Id[]}` | Player[], excludes temporary/self | — | `player_list` |
| `getById` Q | IdInput | Player | — | Excluded: duplicate read |
| `getSelf` Q (B15) | none | Player with isSelf:true | — | Excluded: cockpit identity |
| `create` M | `{name,memo?:string,tagIds?:Id[]}` | Player | — | Excluded: opponent maintenance |
| `update` M | `{id,name?,memo?:string|null,tagIds?:Id[]}` | Player | — | Excluded: opponent maintenance |
| `delete` M | IdInput | Ack | Referenced hand_seat or self row: CONFLICT | Excluded: destructive |
| `hands` Q (B24) | `{id,dateFrom?:DateOnly,dateTo?:DateOnly,...PageInput}` | Page<Hand & {seats:Seat[]}> | Self as opponent target: BAD_REQUEST | Excluded: opponent review |
| `handStats` Q (B24) | `{id,dateFrom?:DateOnly,dateTo?:DateOnly}` | `{handCount,fullHandCount,vpipOpportunities,vpipCount,vpip:number|null,pfrOpportunities,pfrCount,pfr:number|null}` | Self as opponent target: BAD_REQUEST | Excluded: opponent review |

Opponent full-hand denominators and VPIP/PFR follow spec §12; count/summary hands are not fabricated action observations. Date filters resolve the hand's parent play local date. Pagination for player.hands orders `(playedAt,id)` descending with a stable null-time ordering encoded in the string cursor.

## 24. `room` — T01 (completed); final master conventions B25

`Room = {id,name,memo,latitude,longitude,isFavorite,archivedAt,createdAt,updatedAt}`. Coordinates must be supplied or cleared together, latitude [-90,90], longitude [-180,180]. Name is nonempty. No API fetches arbitrary user URLs to populate a room.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | Room[] | — | `room_list` |
| `getById` Q | IdInput | Room | — | `room_get_by_id` |
| `create` M | `{name:string min1,memo?:string,latitude?:number,longitude?:number}` | Room | Coordinate mismatch: BAD_REQUEST | `room_create` |
| `update` M | `{id,name?,memo?:string|null,latitude?:number|null,longitude?:number|null}` | Room | Coordinate mismatch: BAD_REQUEST | `room_update` |
| `archive` M | IdInput | Room | — | `room_archive` |
| `restore` M | IdInput | Room | — | `room_restore` |
| `delete` M | IdInput | Ack | Any entry or ringGame/tournament reference: CONFLICT, archive instead | Excluded: destructive |
| `toggleFavorite` M | IdInput | Room | — | Excluded: toggle |

## 25. `location` — existing surface, retained by B25

Both are mutations (external requests), **Excluded: external quota** in MCP. They do not create rooms.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `search` M | `{query:string 1..200}` | Up to five `{name,address,latitude,longitude}` results | Missing provider key/provider failure: INTERNAL_SERVER_ERROR |
| `resolveLink` M | `{url:valid URL string}` | `{latitude:number,longitude:number}` | Not allowlisted Google Maps link/no coordinates: BAD_REQUEST; upstream failure: INTERNAL_SERVER_ERROR |

Only allowlisted Maps hosts/redirect paths are resolved; arbitrary URL fetching is forbidden by api-security.md. Coordinates still require caller validation when attached to room.

## 26. `filterPreset` — payload migration B22; retained procedures B25

All **Excluded: screen**. `Preset = {id,screenKey:'sessions'|'statistics',name,payload,isDefault,createdAt,updatedAt}`. Name trimmed 1–50; unique case-insensitively within user/screen. The retained screenKey is a UI storage identifier, not an API alias for entry.

Payload keys: `period?:string` (1–30 characters; client date-range shortcut), `dateFrom?:DateOnly,dateTo?:DateOnly,kind?:cash|tournament,roomId?:Id,assetId?:Id,valuation?:real|virtual,baseAssetId?:Id,normalized?:boolean,entryTagIds?:Id[],tournamentTagIds?:Id[]`. Statistics payload obeys the stats mode union; sessions may omit mode. Setting a default clears the previous default only within that screen, atomically.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | `{screenKey:sessions|statistics}` | Preset[] | — |
| `create` M | `{screenKey,name,payload}` | Preset | Duplicate name: CONFLICT |
| `update` M | `{id,name?,payload?}` | Preset | Duplicate name / invalid merged payload: CONFLICT / BAD_REQUEST |
| `delete` M | IdInput | Ack | — |
| `setDefault` M | IdInput | Preset | — |
| `clearDefault` M | IdInput | Preset | — |

B22 migrates stored **keys and values**: `from/to -> dateFrom/dateTo` (UTC-midnight seconds become calendar dates), `type -> kind`, cash_game -> cash, all -> omitted; `currencyId` **and** statistics `currency -> assetId`, statistics `room -> roomId`; display currency/norm off -> normalized false, display/norm normalized -> normalized true with obsolete native mode field removed. Both payload variants lose legacy keys. Existing ids remain ids; invalid/dangling stored selections are removed with a documented migration count, never retained as labels. Converted-mode keys and both tag filters persist unchanged on save/read.

B22 also rebuilds this leaf table with `CHECK (json_valid(payload))`; equal row counts and foreign_key_check are migration gates (spec §10).

## 27. `updateNoteView` — retained by B25

All **Excluded: screen** (read tracking). `View = {id,userId,version,viewedAt}`.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | none | View[] newest viewedAt first | — |
| `markViewed` M | `{version:string min1}` | View | — |

Mark is idempotent per user/version and never duplicates a view on retries.

## 28. `aiExtract` — retained by B25

Both **Excluded: extraction**: MCP clients can interpret images themselves. Inputs share `sources:{kind:'image',data:nonempty base64 string,mediaType:image/jpeg|image/png|image/gif|image/webp}[]`, length 1–5. These procedures return **untrusted extraction suggestions**, not persisted rules/payments; callers choose owned asset/game/tag ids before writing. Legacy OCR vocabulary in the suggestion is not an alternative persisted tournament contract.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `extractTournamentData` M | `{sources}` | `{name?,buyIn?:nonnegative integer,entryFee?:nonnegative integer,startingStack?:nonnegative integer,tableSize?:2..10,chipPurchases?:{name,cost,chips}[],blindLevels?:{isBreak,minutes?,blind1?,blind2?,blind3?,ante?}[]}`; absent unknown fields | Missing key, truncated/missing/invalid structured response: INTERNAL_SERVER_ERROR |
| `extractTablePlayers` M | `{sourceApp:'dmm_waitinglist',sources}` | `{seats:{seatNumber:integer 1..10,name:nonempty string}[]}`; duplicate seat numbers deduplicated | Same provider errors |

## 29. Root infrastructure

`healthCheck` Q: no input, output literal `"OK"`, public; MCP **Excluded: infrastructure**. Retained by B25. `privateData` is deleted by B16, not a protected debug API in the final router.

## 30. Removed procedures and input generations

Names below disappear in the `Removed in` task's PR together with their MCP registration; the `Replacement` task adds the final procedure. This table is a removal map, not a compatibility layer.

| Current procedure / field family | Final replacement | Removed in | Replacement |
| --- | --- | --- | --- |
| session.list/getById/create/update/delete | entry counterparts with final schemas | B06 | B16 |
| session.profitLossSeries | stats.profitLossSeries only | B06 | B16 |
| privateData | None | B16 | B16 |
| liveCashGameSession.*, liveTournamentSession.* | Unified live router (§4) | B06 | B17 |
| live*.reopen | live.undoEndPlay / undoStartNextPlay for mistakes; startNextPlay for continuation | B06 | B19 |
| live*.updateSnapshot | entry/live.overrideRule | B06 | B20 |
| live*.updateHeroSeat | tablePlayer.add/updateSeat/remove with self player | B06 | B17 |
| live*.update handCount/dealerSeat | hand.add/undoLast; derived button | B06 | B10 |
| sessionEvent.* | playEvent.*, one entry/play identity, object v2 payload | B06 | B17/B15 |
| sessionTablePlayer.* | tablePlayer.* | B06 | B17 |
| currency.* | asset.* | B12 | B12 |
| currencyTransaction.listByCurrency/create/update/delete | ledger.listByAsset/createAdjustment/update/delete; exchange uses createExchange | B14 | B14 |
| transactionType.* | ledgerCategory.*; no reserved result category | B14 | B14 |
| sessionTag.* | entryTag.* | B18 | B18 |
| tournament.addTag/removeTag | tournament update tagIds | B18 | B18 |
| blindLevel.* | tournament.getById / whole-version WithLevels writes | B08 | B08 |
| tournamentChipPurchase.* | tournament rule.prices read/write | B08 | B08 |
| keepSnapshot | relink.keepRule | B06 | B20 |
| variant/mixGames labels, flat master blinds, level games | game ids / stakes / immutable ruleVersion + lineups | B07/B08/B13 | B07/B08/B13 |
| currencyId, sessionDate seconds, type cash_game, evCashOut, flat money inputs/outputs | assetId, playedOn, kind cash, evDiff, payments and lines/totals/valuation | B12/B06 | B12/B16/B17 |

## 31. Final MCP tool map

Each row is an exact registry mapping; a comma-separated tool list corresponds positionally to the procedure list. All other procedures above are present in `DELIBERATELY_EXCLUDED` with their stated reasons. Every API-owning task updates registry, schema identity/coupling tests, tool descriptions, `docs/mcp.md` and `docs/mcp.ja.md` in the **same PR**. Handlers call `appRouter.createCaller`, never the database. JSON is returned untrimmed; errors pass through mapToolError, whose forbidden/not-found texts are fixed and id-free.

| Final tool name | Procedure | Owning task |
| --- | --- | --- |
| entry_list | entry.list | B16 |
| entry_get_by_id | entry.getById | B16 |
| entry_create_cash | entry.create (kind cash branch) | B16 |
| entry_create_tournament | entry.create (kind tournament branch) | B16 |
| entry_update | entry.update | B16 |
| stats_summary | stats.summary | B22/B24 |
| stats_breakdown | stats.breakdown | B22/B24 |
| stats_profit_loss_series | stats.profitLossSeries | B22/B24 |
| asset_list | asset.list | B12 |
| asset_rate_list | assetRate.list | B12 |
| user_setting_get | userSetting.get | B12 |
| hand_list | hand.list | B10 |
| hand_get_by_id | hand.getById | B10 |
| room_list, room_get_by_id | room.list, room.getById | T01/B25 |
| room_create, room_update | room.create, room.update | T01/B25 |
| room_archive, room_restore | room.archive, room.restore | T01/B25 |
| ring_game_list_by_room | ringGame.listByRoom | B07 |
| ring_game_create, ring_game_update | ringGame.create, ringGame.update | B07 |
| ring_game_archive, ring_game_restore | ringGame.archive, ringGame.restore | B07 |
| tournament_list_by_room, tournament_get_by_id | tournament.listByRoom, tournament.getById | B08 |
| tournament_create_with_levels, tournament_update_with_levels | tournament.createWithLevels, tournament.updateWithLevels | B08 |
| tournament_archive, tournament_restore | tournament.archive, tournament.restore | B08 |
| game_group_list, game_group_create, game_group_update | gameGroup.list, gameGroup.create, gameGroup.update | B05 |
| game_group_archive, game_group_restore | gameGroup.archive, gameGroup.restore | B05 |
| game_variant_list, game_variant_create, game_variant_update | gameVariant.list, gameVariant.create, gameVariant.update | B05 |
| game_variant_archive, game_variant_restore | gameVariant.archive, gameVariant.restore | B05 |
| game_mix_list, game_mix_create, game_mix_update | gameMix.list, gameMix.create, gameMix.update | B05 |
| game_mix_archive, game_mix_restore | gameMix.archive, gameMix.restore | B05 |
| entry_tag_list, entry_tag_create | entryTag.list, entryTag.create | B18 |
| tournament_tag_list, tournament_tag_create | tournamentTag.list, tournamentTag.create | B18 |
| hand_tag_list, hand_tag_create | handTag.list, handTag.create | B18 |
| player_tag_list, player_tag_create | playerTag.list, playerTag.create | B18 |
| player_list | player.list | B24/B15 (retained read) |

Restore operations for Undo are deliberately excluded from MCP:

| MCP status | Procedure | Owning task |
| --- | --- | --- |
| Excluded: screen | entry.restoreRule, live.restoreRule | B20 |
| Excluded: screen | ringGame.restoreRule | B07 |
| Excluded: screen | tournament.restoreRule | B08 |

Renamed tools, **old → new, without aliases**:

| Removed tool | Final tool | Task |
| --- | --- | --- |
| session_list | entry_list | B16 |
| session_get_by_id | entry_get_by_id | B16 |
| session_create_cash_game | entry_create_cash | B16 |
| session_create_tournament | entry_create_tournament | B16 |
| session_update | entry_update | B16 |
| currency_list | asset_list | B12 |
| session_tag_list | entry_tag_list | B18 |
| session_tag_create | entry_tag_create | B18 |

Each union branch tool uses the router's exact branch schema object, not an MCP-specific schema wrapper. Tool descriptions state array replacement, archive recovery, date/quantity units and all cross-field constraints JSON Schema cannot express. Creates are non-idempotent/non-destructive; in-place referenced-master edits are idempotent/destructive; archive/restore are idempotent/non-destructive. No delete or toggle tool is exposed. The new UI consumes this same API; cache-buster and screen work belong to the UI v3 phases (U01–U12), not a second backend contract.
