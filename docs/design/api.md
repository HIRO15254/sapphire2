# API contract

This document owns procedure names, request/response shapes and the MCP projection. [data-model.md](data-model.md) owns tables, invariants, calculations and event projections. [game-lineups.md](game-lineups.md) owns immutable lineups, rule versions and version-write semantics.

## 1. Conventions

### Authentication, identifiers and errors

Every procedure except root `healthCheck` is authenticated (`UNAUTHORIZED` otherwise). `Id` is a nonempty opaque string; an empty id is `BAD_REQUEST`. Entity references and cursor scopes are ownership-checked. Missing and foreign entities return `FORBIDDEN`; parent membership is checked in addition to ownership.

| Error | Contract |
| --- | --- |
| `BAD_REQUEST` | Invalid shape/order/time, wrong entry kind, mismatched stakes, duplicate members, newly selected archived master, same-asset exchange, editing event-derived fields manually, an owned rule version that does not belong to the named master (restoreRule). |
| `FORBIDDEN` | Missing/foreign entity or cursor scope; accessing a child outside its validated parent; editing entry money through wallet procedures. |
| `CONFLICT` | Unique-name/label collision, duplicate rate effective instant, reference-protected delete, second active/paused play session, unsafe undo (including undoEndPlay/undoStartNextPlay without an undoable step), immutable referenced asset kind/decimals. Reference-protected master deletion explicitly recommends archive. |
| `PRECONDITION_FAILED` | Invalid lifecycle state (including append to an ended play or count add/undo outside active play); missing configured base asset for requested conversion; continuing an explicitly finished entry; rule operation requiring an absent linked master. |
| `INTERNAL_SERVER_ERROR` | External service unavailable or malformed response, or an internal data-integrity failure; never an ownership substitute. |

HTTP error responses omit stack traces. An `INTERNAL_SERVER_ERROR` with a non-tRPC cause is returned as `Internal server error`; deliberate tRPC error messages without such a cause remain visible. MCP maps internal errors to generic text.

Omitted update fields mean unchanged; `null` clears only nullable fields. Supplied arrays replace the entire collection, unless explicitly described otherwise. Validation applies to the resulting merged object where cross-field constraints require it.

Event changes plus projection, exchange pairs, rule writes, and replace-all child writes use D1 `db.batch()`. Default-game seeding can commit separately before a rule write. Inserts respect the 100-bound-parameter limit. Event/hand sequence allocation occurs inside INSERT, not from an earlier application-side MAX.

The D1 budget is Workers Paid's 1,000 queries per Worker invocation, including authentication/session reads and each batch statement. Each mutation must stay within this budget at its maximum admitted input, including nested rule bodies and authentication reads.

Reorder accepts at most 500 tag ids; owner `tagIds` accept at most 100.

hand.update accepts at most 10 seats, 200 actions, 4 boards and 100 `tagIds`/`tagReviews`.

Ring-game rule writes plan one lineup: a newly created lineup spans at most 12 game groups (`MAX_LINEUP_GROUPS`, shared with tournament levels), so a save writes at most 12 stakes. A named mix regrouped by its variants' live game structure beyond that bound is rejected; an existing `lineupId` is reused as stored. 

### Concurrent writes

Writes that depend on earlier reads reassert their preconditions in the atomic batch using the write-guard helpers. A failed guard aborts the whole batch and maps to `CONFLICT`. Any mutation may return `CONFLICT` with "This was changed elsewhere. Reload and try again." when a concurrent change invalidated its precondition. So may the gameGroup, gameVariant and gameMix list queries when they seed the built-in masters while a custom game group is created. The web rolls back optimistic changes, shows that message, and invalidates cached queries for refetch.

Newly selected references that must be active are rechecked atomically; a concurrent archive causes `CONFLICT`. References that the operation permits retaining while archived remain permitted.

### Dates, quantities, lists and common results

- `DateOnly` is a valid calendar string `'YYYY-MM-DD'`: `playedOn`, `localDate`, `dateFrom`, `dateTo`. Date filters are inclusive and use `played_on`; calendar axes do too.
- `Instant` input is an integer Unix **second** in 0–8,640,000,000,000, not milliseconds or a date string. In-process callers receive `Date` values; HTTP and MCP serialize timestamps as ISO-8601 strings. This includes ledger `occurredAt`, rate `effectiveFrom` and all event timestamps. Rate `effectiveFrom: 0` means effective from the beginning.
- Live local dates derive from `userSetting.timeZone`; null means `Asia/Tokyo`. An explicitly supplied local date is validated as a date-only value. Manual money timestamps follow the [data model](data-model.md) manual-line rule, not the server's locale.
- Every written event time in playEvent.create/update and live.create/complete/endPlay/startNextPlay must be at most server now + 60 seconds; otherwise BAD_REQUEST. Check only the time being written, not unchanged existing rows; non-event payload clocks such as timerStartedAt are exempt ([data model](data-model.md) §13.2).
- Money quantities are integers in the asset's smallest unit; `asset.decimals` is 0–4. `Quantity` is 1–10^12. Payment inputs are unsigned; role determines the stored sign. Adjustment inputs are signed nonzero integers with absolute value at most 10^12. Chips, blinds, pots and counts are nonnegative integers, not converted asset amounts. Equity is a percentage in [0,100].
- Aggregate and conversion results outside JavaScript's safe integer range fail with `INTERNAL_SERVER_ERROR` and the message `Integer total exceeds the safe integer range`, rather than returning a rounded amount. MCP maps internal errors to generic text.
- Every money line has its **own required assetId**. Entry/master default asset metadata never makes an omitted payment asset valid. Items/tickets use quantity units exactly like currency lines; they are not silently treated as currency.
- Paginated inputs use opaque **string keyset cursors** and pages return `{ items: T[], nextCursor: string | null }`. Cursors contain the ordering tuple and relevant scope; malformed encoding, JSON or cursor shape is `BAD_REQUEST` and invalid scope is `FORBIDDEN`. Entry cursors include source and filters, but not limit. Hand cursors use the immutable hand sequence, so they stay stable when a hand is deleted and the hand numbers are compacted.
- `PageInput = { cursor?: string, limit?: integer }`; entry/live limits default 20, range 1–100; hand/player-hand default 20, range 1–50; ledger default 20, range 1–100. Entry/live order `(playedOn,id)` descending; hand `(seq,id)` descending; ledger `(occurredAt,id)` descending. Series are chronological.
- Every archivable master list accepts `includeArchived?: boolean` (default false); true includes active **and** archived rows. Historical references always hydrate archived masters regardless of this flag. This applies to asset, room, ringGame, tournament, gameGroup, gameVariant, gameMix and ledgerCategory.
- `IdInput = { id: Id }`; `Ack = { success: true }`; `IdResult = { id: Id }`. Procedures returning a record return the complete documented record, not a database-only fragment. Common auth, ownership and input errors apply to every row below; the error column lists additional cases.
- `Q` / `M` in procedure tables mean query / mutation. `Excluded: <reason>` is an explicit MCP exclusion recorded in DELIBERATELY_EXCLUDED, not an unregistered procedure. The reasons are `cockpit`, `cockpit identity`, `wallet`, `destructive`, `screen`, `screen settings`, `screen ordering`, `duplicate read`, `toggle`, `extraction`, `external quota`, `infrastructure`, `rule workflow`, `narrower structure workflow`, `tag maintenance`, `opponent maintenance` and `opponent review`.

### Undo

All non-destructive mutations in the UI show a toast while running and offer **Undo** for six seconds after success. Derive the inverse's previous values from the same client-cache snapshot used for optimistic-update rollback. Undo sends a compensating request; it is not a deferred write.

Do not offer Undo for an Undo (no redo), hard deletes (`*.delete`, `live.discard`), non-persisting operations (`location`, `aiExtract`) or read tracking (`markViewed`). Hard deletes use only a confirmation Dialog, as required by `web-theme.md`; no API can restore them exactly. An `entry.update` whose `playSessions` omits an existing Day deletes that Day with its hands, so the UI treats it as a hard delete: confirmation Dialog, no Undo.

If a documented error rejects the inverse, show **"Couldn't undo"** and leave state unchanged.

| Operation | Inverse |
| --- | --- |
| create | delete (`live.create` uses `live.discard`) |
| Partial update without a rule change | update with previous values |
| Whole-array replacement | Replace with the previous array (not offered when `entry.update` removes a Day; see above) |
| archive | restore, and vice versa |
| toggleFavorite | toggleFavorite again |
| setDefault | Previous setDefault / clearDefault |
| reorder | Previous order |
| Rule operation | restoreRule |
| ringGame/tournament update with `rule` | restoreRule to the previous current version; if metadata also changed, update with the previous metadata, then restoreRule (two requests; either rejection shows "Couldn't undo") |
| playEvent.create | playEvent.delete |
| tablePlayer operation | playEvent.delete with the returned eventId (for `addNew` / `addTemporary`, the created player row remains; it is not deleted by Undo) |
| hand.undoLast | No Undo; re-add with hand.add |
| undoEndPlay / undoStartNextPlay | No Undo; repeat complete / endPlay / startNextPlay |
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
  id: Id; entryId: Id; playSessionId: Id | null; eventId: Id | null;
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

`lines` preserve signed quantities and line-level provenance; order `(occurredAt,id)` ascending. `totals` are exact native-asset sums, separately for each asset/effect, never a cross-asset number. Role totals expose prize versus bounty and chip-purchase/addon counts without storing a second count. `valuation` delegates to `valuation.ts` and [data model](data-model.md) §12: real and virtual are the service's two valuation modes, **not** two disjoint subtotals to add together. Missing conversion makes the affected valuation null, never zero; no configured base asset makes both null with `baseAssetId:null`. Native totals remain available. Entry reads use the user's configured base asset, not a hidden entry-level currency conversion.

Manual cash permits `buy_in, addon, chip_remove, cash_out`; tournament permits `buy_in, reentry, fee, chip_purchase, prize, bounty`. Start permits cash buy_in and tournament buy_in/fee; re-entry permits reentry/fee; complete permits cash cash_out and tournament prize/bounty; addon-kind tournament prices produce chip_purchase lines (plus fee when present), not cash addon lines. Entry payment effects may be real or virtual and default to real. Prices never infer an asset omitted from a payment. Zero-cost attendance uses no money line, not a zero line.

### Play sessions and entry records

```ts
type EndState = 'bagged' | 'held' | 'busted' | 'cashed_out' | 'finished';
type ManualPlay = {
  id?: Id; // preserve an existing Day's identity on manual update
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

Kind-specific details are mutually exclusive. The tournament's `totalEntries` is field size; aggregate counts are always `entryCount`. `ruleDrift` is false without a linked master, otherwise `ruleVersionId !== currentMasterRuleId`, not a field comparison. Play sessions are seq ascending. `playMinutes` sums each timed Day's duration less breaks at second resolution, expressed as fractional minutes; Days without both endpoints contribute zero. Big blind, EV and settled status follow [data model](data-model.md) §12/§13.

`ManualPlay` times must be ordered, break duration valid, and plays chronological/nonoverlapping. Earlier plays close held/bagged; the last closes in a settled end state valid for kind; held/bagged require endStack. Manual records may omit wall-clock times without fabricating duration. `playedOn` equals the minimum local date. Entry create accepts either one top-level `payments` array for a single play or payments inside `playSessions[]`; multi-play requests must use per-play payments, and simultaneous top-level/per-play money is `BAD_REQUEST`.

On manual update, a supplied `ManualPlay.id` identifies an existing Day of that entry; preserve its id and attached hands rather than delete/recreate it. Omit id for a new Day. An id on create is FORBIDDEN; duplicate ids are BAD_REQUEST. Ownership and parent-membership checks apply. Break minutes are integers from 0 to 100,000 and endStack is nonnegative.

### Games and immutable rule bodies

`GameInput = { variantId: Id } | { gameMixId: Id } | { lineupId: Id }`; each branch is strict. A level's `game:null` means inherit. `StakeInput = { gameGroupId: Id, blind1?:number|null, blind2?:number|null, blind3?:number|null, ante?:number|null, anteType?:'none'|'all'|'bb'|null }`. Exactly one stake per effective lineup group in group order; mismatch is `BAD_REQUEST`. An owned lineup id can preserve archived selections; newly selecting an archived variant, its archived group, or an archived mix is rejected. Omitted game inherits the linked master, otherwise builtin NLH. Omitted stakes carry by `(gameGroupId, occurrence within that structure)`; tournament levels carry from the same level index.

For newly written stake rows, the server rejects a null/omitted blind marked Required by its game group, or a value in a blind field without a label (`BAD_REQUEST`). Every stake row of a new rule version counts as newly written, including values carried forward from the previous version when `stakes` is omitted. Ante is outside this requirement system. Reusing an existing immutable rule version does not revalidate its stakes. The shared rule-write service enforces this.

Ante type follows the game group's `fixedAnteType`, for stakes the client supplies only. When it is set, an omitted or null `anteType` is saved as the fixed type, an equal one is kept, a different one is `BAD_REQUEST`, and a group fixed to `none` also rejects a non-null `ante` (`BAD_REQUEST`). A null `fixedAnteType` keeps the supplied value. Carried stakes and reused versions are neither checked nor rewritten, and changing a group's setting never rewrites saved stakes. Ante amounts stay optional.

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

Table size is 2–10; minBuyIn and maxBuyIn are nonnegative integers at most 10^12, and minBuyIn <= maxBuyIn. Tournament rule maxima: 100 levels, 12 stakes per level (one per lineup group) and 20 prices. Level minutes are 1–10,000 or null; starting stack and chips are nonnegative safe integers, bounty amount and price amount/fee are nonnegative integers at most 10^12. Price label is trimmed to at most 100 characters and defaults to an empty string; houseRules maximum is 50,000. AssetId is required even for a free price. Breaks have no stakes/game override. Supplied levels/prices replace the whole collection; each structural edit writes one immutable version.

`LineupMap` maps lineup id to `{id,gameMixId,displayName,groups:[{id,gameGroupId,name,variants:[{id,label,shortLabel}]}]}`. `CashRule` is `{id,ringGameId,parentRuleId,lineupId,stakes,...cash scalar fields}`. `TournamentRule` is `{id,tournamentId,parentRuleId,lineupId,...tournament scalar fields,levels,prices}`. Output stake adds `lineupGroupId`; level adds `id,ordinal,level,effectiveLineupId` and returns `game:null` for inheritance; price adds `id,ordinal`. Ordinals derive from array order. Master ownership ids may be null only for standalone entry versions. Display names resolve current user-owned master labels, including archived rows; composition never changes retroactively.

## 3. `entry`

| Procedure | Input (constraints) | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | PageInput; `kind?,status?:open|settled,roomId?,assetId?,dateFrom?,dateTo?` | Page<EntryOutput> | Date range reversed: BAD_REQUEST | `entry_list` |
| `getById` Q | IdInput | EntryOutput | — | `entry_get_by_id` |
| `create` M | Discriminator `kind:cash|tournament`; `playedOn:DateOnly`, `playSessions?:ManualPlay[]` (nonempty; at most 100 plays and 1000 payments), `payments?:Payment[]` (single play), `roomId?,assetId?,title?:string<=100,memo?:string<=5000,tagIds?:Id[]`; cash: `ringGameId?,rule?:CashRuleInput,evDiff?:signed integer`; tournament: `tournamentId?,rule?:TournamentRuleInput,placement?:positive integer,totalEntries?:positive integer,beforeDeadline?:boolean=false` | EntryOutput, source manual | placement > totalEntries unless beforeDeadline; inconsistent playedOn/plays: BAD_REQUEST | `entry_create_cash`, `entry_create_tournament` |
| `update` M | `id`; mutable create fields optional; kind/source immutable; nullable metadata may clear; playSessions/payments/tagIds replace all when supplied | EntryOutput | Live event-derived fields, wrong-kind fields, invalid playedOn/plays or top-level payments on a multi-play entry: BAD_REQUEST | `entry_update` |
| `delete` M | IdInput | Ack | — | Excluded: destructive |
| `overrideRule` M | Discriminator `kind`: `{id,kind:cash,rule:CashRuleInput}` or `{id,kind:tournament,rule:TournamentRuleInput}`; omitted rule fields keep the entry's current version | EntryOutput | Kind other than the entry's, invalid stake coverage or live seat outside reduced tableSize: BAD_REQUEST | Excluded: rule workflow |
| `applyMasterRule` M | IdInput | EntryOutput | No linked master: PRECONDITION_FAILED | Excluded: rule workflow |
| `pushRuleToMaster` M | IdInput | EntryOutput | No linked master: PRECONDITION_FAILED | Excluded: rule workflow |
| `relink` M | `{id,ringGameId:Id|null,keepRule:boolean}` or tournament twin, matching kind | EntryOutput | Wrong-kind link: BAD_REQUEST | Excluded: rule workflow |
| `restoreRule` M | `{id,masterId:Id|null,ruleVersionId:Id,masterRuleVersionId?:Id}` | EntryOutput | Owned version belongs to another master (or is not standalone when masterId is null), or masterRuleVersionId without a master: BAD_REQUEST; missing/foreign version: FORBIDDEN | Excluded: screen |

List asset filtering means **has a ledger line in that asset**, real or virtual, not entry default asset equality. By contrast, native `stats` mode requires a real line in the selected asset. Use `stats` with an explicit mode for aggregate results. Open entries remain visible; statistics do not count them. Omitting playSessions on manual create synthesizes one ended play on playedOn. `beforeDeadline:true` stores placement null. Array tag ids are unique and owner-checked.

Limits: one entry holds at most 100 playSessions, 1000 payments in total and 100 tagIds; list pages hold at most 100 entries. Update reads the rule version only for output and price checks; it never takes `ringGameId`, `tournamentId` or `rule`. A ManualPlay `id` must name an existing Day of that entry (else FORBIDDEN); kept Days keep their id and hands, Days left out are deleted with their hands, and Days without id are inserted, so an update that keeps every Day is undone by sending the previous values. Days before the last end held (cash) or bagged (tournament) with endStack; the last ends cashed_out/finished (cash) or busted/finished (tournament); placement is not cross-checked against the end state. A synthesized Day ends cashed_out (cash), finished when placement is 1, busted otherwise (tournament). Payment priceIds must belong to the entry's rule version or already be used by the entry, with the price's asset and a role its kind pays (entry: buy_in/fee, reentry: reentry/fee, addon: chip_purchase/fee). Live entries accept only roomId, assetId, title, memo and tagIds. Delete removes the entry, its Days, hands, lines and tag links; its standalone rule version stays.

Rule operations are also present on live (§4). Override inserts a child under the same master and changes only the entry; unchanged signature reuses the version. Apply points to the linked master's current version. Push points the master to the entry's same-master version (or creates an equal version under that master) and aligns both ids. Relink with keepRule false applies the destination's current version; true preserves the entry's rule under that master, reusing a suitable version or creating a copy. A null destination preserves the content in a standalone version and ignores keepRule. Ordinary `update` may change metadata, but changing an already-linked master uses `relink`.

`restoreRule` restores the entry's master link and existing rule version in one batch; when supplied, `masterRuleVersionId` also restores that master's current version in the same batch. Every version must belong to that master; with `masterId:null`, the entry version must be standalone. No new version is created. Archived masters and versions are allowed because this only restores saved values. Live entries also apply the tableSize/active player and self-seat validation. This is the inverse of overrideRule, applyMasterRule, pushRuleToMaster and relink; to undo createAndAssign*, follow restoreRule with deletion of the created master.

New payments may reference only existing prices in the selected immutable tournament version. When replacing manual payments, an older price already used by the entry may be retained up to its existing line count. To create a new price and pay it, first write the rule through a rule operation/master operation, read the returned price id, then record the payment. Manual payments may omit priceId; no temporary client id is accepted. Changing a rule version preserves existing priced lines' original references.

On update, top-level payments apply only to a single stored Day. A changed first local date requires a matching `playedOn` in the same request. A priced payment with the wrong asset or role is BAD_REQUEST; a foreign or unavailable price is FORBIDDEN. Manual `evDiff` is bounded to ±10^12.

Entry updates reject with CONFLICT if the entry facts, play days or stored payment references used for validation change before the write batch commits. The batch applies no part of the rejected update.

## 4. `live`

Live reads and successful entry mutations return EntryOutput, except `discard`, which returns Ack. Live tournament records additionally return `progress:{currentStack:number|null,remainingPlayers:number|null,totalEntries:number|null,chipTotal:number,averageStack:number|null}`; live cash records return `progress:null`. The server fold and formula are owned by [data model](data-model.md) §13.2. `getById` additionally returns `{events:PlayEvent[],currentPlaySessionId:Id|null,currentButtonSeat:number|null}`. Every by-id procedure rejects a manual or imported entry with BAD_REQUEST. All procedures are **Excluded: cockpit** in MCP, including reads and rule operations, except `restoreRule` (**Excluded: screen**).

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | Entry list filters + PageInput; source is live | Page<EntryOutput> | — |
| `getById` Q | IdInput | EntryOutput + live detail above | Non-live target: BAD_REQUEST |
| `create` M | `kind:cash|tournament,roomId?,assetId?,memo?,startedAt?:Instant,localDate?:DateOnly,label?:string<=50,payments:Payment[]`; matching `ringGameId?`/`tournamentId?`, `rule?`; tournament `initialStack?:nonnegative integer,timerStartedAt?:Instant,startLevel?:positive integer` | EntryOutput + tournament progress | Existing active/paused play: CONFLICT; initialStack writes the first update_stack in the creation batch; payments at most 1000 (cash buy_in; tournament buy_in/fee) |
| `createAndAssignRingGame` M | `{entryId,...ringGame.create input}` | EntryOutput | Cash only; create and relink one batch |
| `createAndAssignTournament` M | `{entryId,...tournament.createWithLevels input}` | EntryOutput | Tournament only; create and relink one batch |
| `update` M | `{id,memo?:string|null,roomId?:Id|null,assetId?:Id|null}` | EntryOutput | Other fields are not accepted as updates |
| `complete` M | `{id,occurredAt?:Instant,endState:cashed_out|busted|finished,payments:Payment[],beforeDeadline?:boolean,placement?:positive integer,totalEntries?:positive integer}` | EntryOutput | Invalid kind/result or terminal time: BAD_REQUEST; no active/paused play: PRECONDITION_FAILED |
| `endPlay` M | `{id,occurredAt?:Instant,endState:held|bagged,stackAmount:nonnegative integer}` | EntryOutput | held cash only, bagged tournament only; terminal time earlier than an existing event of this play or beyond now+60s: BAD_REQUEST before writes |
| `startNextPlay` M | `{id,startedAt?:Instant,localDate?:DateOnly,label?:string<=50,startLevel?:positive integer,payments?:Payment[]}` | EntryOutput | No ended predecessor, finished or cashed_out: PRECONDITION_FAILED; competing active play: CONFLICT; invalid payment, level or time: BAD_REQUEST |
| `undoEndPlay` M | IdInput | EntryOutput | Highest-seq play must end with its terminal event and have no later dependent event: CONFLICT |
| `undoStartNextPlay` M | IdInput | EntryOutput | Highest seq must be >1 and contain only its start event, no hands/other descendants: CONFLICT |
| `discard` M | IdInput | Ack | Settled target: PRECONDITION_FAILED |
| `overrideRule` M | Same as entry.overrideRule | EntryOutput | Reduced tableSize excludes active player/self seat: BAD_REQUEST |
| `applyMasterRule` M | IdInput | EntryOutput | Reduced tableSize excludes active player/self seat: BAD_REQUEST; no linked master: PRECONDITION_FAILED |
| `pushRuleToMaster` M | IdInput | EntryOutput | No linked master: PRECONDITION_FAILED |
| `relink` M | Same as entry.relink | EntryOutput | Reduced tableSize excludes active player/self seat: BAD_REQUEST |
| `restoreRule` M | `{id,masterId:Id|null,ruleVersionId:Id,masterRuleVersionId?:Id}`; same atomic restore and version-membership rules as entry.restoreRule | EntryOutput | Wrong-master/non-standalone version or masterRuleVersionId without a master: BAD_REQUEST; reduced tableSize excludes active player/self seat: BAD_REQUEST; archived masters/versions allowed; MCP Excluded: screen |

For `complete`, cash permits `cashed_out` or `finished` and cash_out payments; tournament permits `busted` or `finished` and prize/bounty payments. Tournament completion requires placement and totalEntries unless beforeDeadline is true; in that case supplied placement and totalEntries are omitted. Cash rejects tournament result fields. `startNextPlay` permits reentry/fee payments only after a tournament bust, rejects `startLevel` for cash, and requires a start time no earlier than the preceding end.

EndPlay writes day_end, leaving entry open; complete writes session_end. State is taken from play_session.status, so no ordinary append can revive an ended play. Next-play after held/bagged continues; after tournament busted it re-enters; after finished it fails. Cash cashed_out requires explicit undo/correction before continuation, as specified in [data model](data-model.md) §13.3; startNextPlay never silently rewrites a receipt or terminal event. Re-entry payments are embedded in the new session_start and written in that **same batch**, not a second API call/event; allowed only for tournament re-entry, roles reentry/fee. Seat state carries forward. `undoEndPlay` removes the terminal event and reprojects to active (the global active-play guard still applies). `undoStartNextPlay` removes that empty last play plus its start/payment projection. These are the only lifecycle undo procedures; there is no reopen.

## 5. `playEvent`

`PlayEvent = {id,entryId,playSessionId,eventType,occurredAt,sortOrder,payload,schemaVersion:number,createdAt,updatedAt}`. Writers validate payloads and set schema version 2. Reads return the stored schema version and the registry-parsed payload when parsing succeeds; otherwise they return the stored JSON value. A linked hand id is reinserted into the returned payload. Event ids are the only event identity. All procedures are **Excluded: cockpit**.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | `{entryId,playSessionId?:Id}` | PlayEvent[] ordered `(occurredAt,sortOrder,id)` ascending | — |
| `create` M | `{entryId,playSessionId?:Id,eventType,occurredAt?:Instant,payload}` discriminated by type | PlayEvent | No active/paused target or ended target: PRECONDITION_FAILED |
| `update` M | `{id,occurredAt?:Instant,payload?:matching payload}`; type immutable | PlayEvent | Lifecycle changes outside live operations, or player_join/player_leave (changed only through tablePlayer and undone through delete): BAD_REQUEST |
| `delete` M | IdInput | Ack | Lifecycle event: BAD_REQUEST; use named live undo. player_join/player_leave in an ended Day or with subsequent events: CONFLICT; invalid resulting event stream: BAD_REQUEST |

Omitted playSessionId selects the non-ended play only; it never falls back to an ended latest play. Ordinary event edits/deletes must leave the complete ordered stream valid and atomically reproject. Ended-play historical ordinary-event corrections are allowed only if the final lifecycle remains ended; new appends to it are not. Kind and state validation use [data model](data-model.md) §13.

`playEvent.delete` can undo a tablePlayer operation by its returned eventId only while it is that player's latest participation/seat event, the Day is non-ended, and no subsequent event exists; otherwise `CONFLICT` (unsafe undo).

| eventType | Payload object | User create/update/delete |
| --- | --- | --- |
| session_start | `{payments?:Payment[],timerStartedAt?:integer|null,startLevel?:nonnegative integer}` | Live lifecycle only |
| session_end | `{endState?:cashed_out|busted|finished,payments:Payment[],beforeDeadline?,placement?,totalEntries?}`; live.complete stores the endState it was given, and a stored row without one derives cashed_out for cash, finished for placement 1, else busted | Live lifecycle only |
| day_end | `{endState:held|bagged,stackAmount:number}` | Live lifecycle only |
| reentry | `{payments:Payment[]}` | Active tournament only; same-day re-entry; terminal-play continuation uses startNextPlay |
| table_change | `{tableLabel?:string 1..100,seatPosition?:integer 0..9}` | Yes; seat must fit the table size |
| session_pause / session_resume | `{}` | Yes; matching active/paused transition |
| chips_add_remove | `{amount:signed nonzero integer with absolute value at most 10^12,assetId:Id,effect?:real|virtual}` | Cash only; explicit asset |
| all_in | `{potSize:nonnegative integer,trials:positive integer,equity:number 0..100,wins:number 0..trials,handId?:Id}` | Cash only; fractional wins represent chopped pots; hand must belong to the same play and user (otherwise FORBIDDEN). `handId` is stored as `play_event.hand_id` and returned in the payload; an update payload without it unlinks the hand |
| purchase_chips | `{priceId:Id,payments:Payment[]}`; payment roles chip_purchase and fee (an add-on price's fee is its own line), every payment pays priceId | Tournament only; add-on price of the entry's current rule version, or a price retained by the same event when updating it; server resolves immutable label/chips from price |
| update_stack | `{stackAmount:nonnegative integer,remainingPlayers?:positive integer|null,totalEntries?:positive integer|null,chipPurchaseCounts?:{name:string 1..100,count:nonnegative integer,chipsPerUnit:nonnegative integer}[]}` | Yes; at most 100 chipPurchaseCounts rows on input; explicit null clears field size/progress, omission keeps it; cumulative chip counts are progress-only, not payments ([data model](data-model.md) §13.2) |
| player_join | `{playerId:Id,seatPosition?:integer 0..9|null}`; while the player is active, a number moves them, `null` stands them up and omission keeps the seat | Via tablePlayer operations |
| player_leave | `{playerId:Id}` | Via tablePlayer operations |
| memo | `{text:string 1..5000}` | Yes |

Every append, including memo/seats, writes version 2. Event reads use the registry schemas with the fallback described above.

## 6. `tablePlayer`

Event-derived membership, not a second table. `TablePlayer = {id,player:Player,isActive:boolean,joinedAt:Timestamp,leftAt:Timestamp|null,seatPosition:number|null,stints:{joinedAt,leftAt,seatPosition}[]}`. All mutations require a non-ended play and emit player events in the same projection batch. All procedures are **Excluded: cockpit**.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | `{entryId,activeOnly?:boolean=false}` | `{items:TablePlayer[]}` in first-join order across Days | — |
| `add` M | `{entryId,playerId,seatPosition?:integer 0..9}` | `{id,playerId,eventId:Id}` | Duplicate active membership/seat: CONFLICT |
| `addNew` M | `{entryId,playerName:trimmed string 1..100,playerMemo?:string<=50000,playerTagIds?:Id[],seatPosition?:integer 0..9}` | `{id,playerId,eventId:Id}` | — |
| `addTemporary` M | `{entryId,seatPosition?:integer 0..9}` | `{id,playerId,eventId:Id}` | — |
| `updateSeat` M | `{entryId,playerId,seatPosition:integer 0..9|null}` | `{id,playerId,eventId:Id}` | Occupied seat: CONFLICT; player not active or seat outside table size: BAD_REQUEST |
| `remove` M | `{entryId,playerId}` | `{id,playerId,eventId:Id}` | Player not active: BAD_REQUEST |

Every mutation returns the emitted event's `eventId`. Undo deletes it through `playEvent.delete`; only that player's latest participation/seat event is eligible. An ended Day or subsequent events make deletion unsafe (`CONFLICT`), with no partial state change.

Mutations require a live entry and a non-ended play; join/leave event times use server time. `addTemporary` creates a temporary player named `Anonymous`. `list` accepts manual entries, which have no table-player events.

Hero is the user's `player.isSelf:true` row, returned here like any other seated player and obtained with player.getSelf. `isHero` is derived from that identity, never independently editable. Hero joins/moves/leaves through these same procedures. Regular player lists, opponent statistics and new-opponent pickers exclude self.

## 7. `hand`

`Hand = {id,playSessionId,handNo,playedAt,detail:count|summary|full,buttonSeat,tableSize,levelOrdinal,stakes,variantId,pot,rake,memo,boards:string[],tags,createdAt,updatedAt}`. Nullable scalar fields are explicit null. `Seat = {seat,playerId,isHero,startStack,holeCards,net,showed}`; playerId, startStack, holeCards and net are nullable. `Action = {seq,street,seat,action,amount,allIn}`; amount is nullable. Net is signed; other chip amounts nonnegative. isHero is stored from the self-player identity on write, not supplied as an independent input.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{playSessionId,...PageInput}` (max 50) | Page<Hand & {seats:Seat[]}> | — | `hand_list` |
| `getById` Q | IdInput | Hand & `{seats:Seat[],actions:Action[]}` | — | `hand_get_by_id` |
| `add` M | `{playSessionId,buttonSeat?:0..9|null,tableSize?:2..10|null,levelOrdinal?:positive integer|null,stakes?,variantId?:Id|null,playedAt?:Instant}` | Hand | Play must be active (not paused/ended): PRECONDITION_FAILED | Excluded: cockpit |
| `undoLast` M | `{playSessionId}` | Ack | Not active: PRECONDITION_FAILED; no hand, last hand not count or linked all-in: CONFLICT | Excluded: cockpit |
| `update` M | `{id,detail:count|summary|full,buttonSeat,tableSize,levelOrdinal,stakes,variantId,tagIds?:Id[],tagReviews?:{tagId:Id,reviewedAt:Instant|null}[],...detail body}` | Hand & `{seats,actions}` | Invalid seats/actions/cards, summary hero not self, review of an unattached tag: BAD_REQUEST | Excluded: cockpit |
| `delete` M | IdInput | Ack | Linked all-in: CONFLICT | Excluded: destructive |

Every level writes the context fields `buttonSeat,tableSize,levelOrdinal,stakes,variantId` (each explicitly nullable). Count has no child details and clears pot/rake/memo. Summary body has `boards` (0–4 boards, up to 5 cards each), `pot,rake,memo:string<=2000` (nullable) and `hero:{seat,playerId,startStack,holeCards,net,showed}`; hero.playerId must be the self player (another owned player: BAD_REQUEST). Full has those shared fields plus `seats` (1–10) of `{seat,playerId:Id|null,startStack,holeCards,net,showed}` and `actions` (0–200). Seats carry no isHero input: the stored and returned isHero is true exactly for the seat whose playerId is self. Seats/actions/boards are replaced in full in one batch; lowering detail deletes obsolete detail children. Cards match `[2-9TJQKA][shdc]`, separated by spaces (up to seven hole cards), with no duplicate within one board or seat. Seats are unique 0–9, actions refer to present seats, a player sits in at most one seat (so at most one self seat); showed requires hole cards, and show action requires showed. Action enum: post,straddle,bring_in,fold,check,call,bet,raise,draw,show,muck. Street is an integer 0–7, preserving the shared hand action schema's game-independent street ordinal. Omitted `tagIds` keeps the links; supplied `tagIds` replaces them, and a kept tag keeps its reviewedAt unless `tagReviews` names it. Deletion compacts handNo; button is derived from the highest remaining hand. Detail review/edit may occur after play ends; only count add/undo is active-only. All-in linking is playEvent payload.handId, never an independent cross-session link mutation.

## 8. `asset`

`Asset = {id,name,unit,description,kind:currency|item,decimals,archivedAt,isFavorite,balance,createdAt,updatedAt}`. Balance is signed native quantity per [data model](data-model.md) §12.4, including real entry and wallet lines; for an item the same field is holdings. A buy-in reduces it immediately even while the entry is open. Virtual lines never change balance.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | Asset[] ordered favorite first, then createdAt and id ascending | — | `asset_list` |
| `getById` Q | IdInput | Asset | — | Excluded: duplicate read |
| `create` M | `{name:trimmed string 1..100,unit?:string<=20,description?:string<=50000,kind:currency|item,decimals?:integer 0..4=0}` | Asset | Case-insensitive trimmed name collision: CONFLICT | Excluded: wallet |
| `update` M | `{id,name?,unit?:string<=20|null,description?:string<=50000|null,kind?,decimals?}` | Asset | Name collision: CONFLICT; kind or decimals change when referenced anywhere: CONFLICT | Excluded: wallet |
| `archive` M | IdInput | Asset | — | Excluded: wallet |
| `restore` M | IdInput | Asset | — | Excluded: wallet |
| `delete` M | IdInput | Ack | Any ledger/rate/entry/master-default/price/setting reference: CONFLICT, message "Asset is in use; archive it instead" | Excluded: destructive |
| `toggleFavorite` M | IdInput | Asset | — | Excluded: toggle |

Archived assets retain references, rates and balances. New selections must be active; unchanged historical references remain readable. For manual payment replacement, archived asset references may be retained up to their existing count in the entry. For live event edits the limit is the existing count in that event; new events cannot select an archived asset.

## 9. `assetRate`

`Rate = {id,baseAssetId,quoteAssetId,rateNum,rateDen,effectiveFrom,memo,createdAt}`. Directed rate is quote smallest units per base smallest unit, represented by a positive rational; asset decimals are not silently applied a second time. Conversion resolution and rounding are exclusively [data model](data-model.md) §12 / valuation.ts.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{baseAssetId?:Id,quoteAssetId?:Id,effectiveAt?:Instant}` | Rate[], pair then effectiveFrom descending | — | `asset_rate_list` |
| `create` M | `{baseAssetId,quoteAssetId,rateNum:integer 1..10^12,rateDen:integer 1..10^12,effectiveFrom:Instant>=0,memo?:string<=5000}` | Rate | Same asset: BAD_REQUEST; same directed pair/effectiveFrom: CONFLICT | Excluded: wallet |
| `delete` M | IdInput | Ack | — | Excluded: destructive |

Without effectiveAt, list returns matching history. With it, returns only latest `effectiveFrom <= effectiveAt` per directed pair (not synthesized reciprocal/two-hop rates). Rates are immutable; correction deletes then creates. Rate creation accepts owned archived assets. Base/quote naming here does not require an item to be a currency; userSetting's reporting base does. Rates are effective-time history: creating or deleting a rate re-values every past line whose occurredAt it now governs.

## 10. `userSetting`

`Setting = {baseAssetId:Id|null,timeZone:string|null}`. Null zone means Asia/Tokyo; null base means conversion has not been configured. Changing baseAssetId re-reports every past converted figure in the new base; nothing stores a past valuation. A newly selected base must be an owned, active currency; keeping an already selected archived base is allowed.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `get` Q | none | Setting (defaults even without a stored row) | — | `user_setting_get` |
| `update` M | `{baseAssetId?:Id|null,timeZone?:IANA time zone|null}` | Setting | Non-currency or newly selected archived base, invalid zone: BAD_REQUEST | Excluded: screen settings |

## 11. `ledger`

All procedures are **Excluded: wallet** (delete additionally destructive). Wallet writes cannot mutate projected or manual entry lines: `FORBIDDEN`, regardless of the line's owner. Entry money is changed only through entry/live.

`WalletLine = {id,assetId,role:adjustment|exchange,quantity,effect:real,categoryId:null|Id,entryId:null,transferId:null|Id,occurredAt,memo:string|null}`. History items are `{kind:wallet,line:WalletLine}` or `{kind:entry,id,entryId,title:string|null,assetId,quantity,occurredAt}`; the latter sums real lines for that entry/asset and uses their earliest timestamp, and `id` equals `entryId`. Virtual entry lines do not masquerade as wallet balance movements. The cursor carries the asset id and the boundary `(occurredAt,id)`; another asset's cursor is FORBIDDEN.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `listByAsset` Q | `{assetId,...PageInput}` | Page<HistoryItem> | — |
| `createAdjustment` M | `{assetId,quantity:signed nonzero integer,categoryId?:Id,occurredAt:Instant,memo?:string<=5000}` | WalletLine | Archived asset or category: BAD_REQUEST |
| `createExchange` M | `{from:{assetId,quantity:Quantity},to:{assetId,quantity:Quantity},occurredAt:Instant,categoryId?:Id,memo?:string<=5000}` | `{transferId,lines:[WalletLine,WalletLine]}` (from, then to) | Same asset, archived asset or category: BAD_REQUEST |
| `update` M | `{id,occurredAt?:Instant,memo?:string<=5000|null,categoryId?:Id|null,quantity?:signed nonzero integer}` | `{lines:WalletLine[]}` (both legs of an exchange, outgoing first) | Entry line: FORBIDDEN; changing exchange sign or newly selecting an archived category: BAD_REQUEST |
| `delete` M | IdInput | Ack | Entry line: FORBIDDEN |

Exchange atomically writes negative from and positive to with one transferId. Editing time/memo/category changes both rows; a quantity edit affects only the selected leg and must carry its existing sign. Delete removes both legs. Keeping a line's already archived category is allowed. No automatic equal-value/rate assumption is imposed on the user's entered exchange quantities.

## 12. `ledgerCategory`

`Category = {id,name,archivedAt,createdAt,updatedAt}`. Names are trimmed, case-insensitively unique per user including archived rows.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | Category[] ordered lower(name), id ascending | — | Excluded: wallet |
| `create` M | `{name:trimmed string 1..100}` | Category | Duplicate: CONFLICT | Excluded: wallet |
| `update` M | `{id,name:trimmed string 1..100}` | Category | Duplicate: CONFLICT | Excluded: wallet |
| `archive` M | IdInput | Category | — | Excluded: wallet |
| `restore` M | IdInput | Category | — | Excluded: wallet |
| `delete` M | IdInput | Ack | Referenced by a ledger line: CONFLICT, message "Category is in use; archive it instead" | Excluded: destructive |

## 13. `stats`

Only **settled entries** contribute to every stats procedure, including series, count, win/ITM/ROI and durations. Time, BI, ROI, EV, BB, hand eligibility and rounding follow [data model](data-model.md) §12 rather than a second set of API formulas. ROI is tournament-only; 1 BI excludes re-entry payments. Calendar grouping uses playedOn; duration sums each play separately, never an entry-spanning wall-clock interval.

Exactly one mode is required:

| Mode input | Meaning / output unit |
| --- | --- |
| `{assetId:Id}` | Native real lines in the selected asset only, without conversion. Population requires at least one real line in that asset; entries with other assets are included. |
| `{valuation:'real'|'virtual',baseAssetId?:Id}` | Converted mode; base defaults to userSetting.baseAssetId and must be currency. Missing configured base: PRECONDITION_FAILED. |
| `{normalized:true}` | BB for cash and BI for tournaments; separate outputs/series, never a BB+BI total. BI normalization can require the configured base and rates for multi-asset or item payments. No raw cross-asset amount/ROI is fabricated. |

Supplying conflicting mode fields or a baseAssetId without valuation is BAD_REQUEST; normalized:false is absence, not another mode. Common filters: `{kind?:cash|tournament,roomId?:Id,dateFrom?:DateOnly,dateTo?:DateOnly,entryTagIds?:Id[],tournamentTagIds?:Id[]}`. Within a tag kind, ids mean any matching tag; across kinds filters intersect. Empty arrays do not filter. Tournament-tag filtering selects entries linked to tagged tournament masters. Each array contains at most 100 unique ids. Foreign filter ids return FORBIDDEN.

`Coverage = {entryCount,excludedEntryCount,missingRates:MissingRate[],multiAssetEntryCount,otherAssetIds:Id[],unavailableNormalizationEntryCount}`. entryCount counts the settled population before missing-rate/denominator exclusions; excludedEntryCount reports entries excluded from a selected valuation. In native mode otherAssetIds includes other assets from lines of either effect, sorted by id, and multiAssetEntryCount counts entries with any such line. No native total claims to be whole-entry P/L when another asset exists.

`Metrics = {winCount,lossCount,winRate,playMinutes,handCount,cashEntryCount,tournamentEntryCount,itmCount,itmRate,averagePlacement,roi,bbPerHour,bb100,handsPerHour,evRecordedEntryCount,evDiff,evProfitLoss}` (formulas in [statistics.md](statistics.md#hands)). Undefined ratios/EV are null, not zero. Monetary fields in normalized mode are null; `normalized:{cash:{unit:'bb',entryCount,unavailableEntryCount,profitLoss,evProfitLoss}|null,tournament:{unit:'bi',entryCount,unavailableEntryCount,profitLoss}|null}` carries the dimensionless alternatives. Other modes return `amounts:Amounts` in the selected asset/base and `normalized:null`. Coverage reports exclusions for each normalized branch as well as overall.

`winRate` and `itmRate` are percentages from 0 to 100. `bbPerHour` and `bb100` use eligible cash entries even when valuation excludes an entry; `handsPerHour` uses entries counted in the selected mode. The length bucket is `unknown` only when no play has both start and end.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `summary` Q | Mode + common filters | `{mode:asset|valuation|normalized,assetId:Id|null,valuation:real|virtual|null,baseAssetId:Id|null,...Coverage,...Metrics,amounts:Amounts|null,normalized}` | Invalid mode, date range or non-currency base: BAD_REQUEST; absent base: PRECONDITION_FAILED | `stats_summary` |
| `breakdown` Q | Summary input + `groupBy:room|stakes|kind|dayOfWeek|length|month|year|variant` | `{groups:[{key:string,label:string,...Coverage,...Metrics,amounts,normalized}],coverage:Coverage}` | Same mode, filter and base errors as summary | `stats_breakdown` |
| `profitLossSeries` Q | Summary input | `{points:[{id,kind,playedOn,profitLoss:number|null,evProfitLoss:number|null,evRecorded:boolean,playMinutes:number|null,bigBlind:number|null,buyInTotal:number|null,unit:asset|bb|bi}],coverage:Coverage}` | Same mode, filter and base errors as summary | `stats_profit_loss_series` |

Points are per-entry **deltas**, not running totals, ordered `(playedOn,id)` ascending. `buyInTotal` is the [data model](data-model.md) normalization denominator, not all re-entry costs. Variant keys are `mix:<id>`, `variant:<id>`, or `custom`; labels resolve current masters. Stakes keys derive game-group ids and native stake values; multi-group lineups use a multi-group bucket and tournaments use a tournament bucket. Room keys are ids (null room is `none`). Calendar buckets are month, year and weekday 0–6. Length buckets are `<1h`, `1-2h`, `2-4h`, `4-8h`, `8h+`, `unknown`. Mixed cash/tournament normalized series have distinct units on every point.

Breakdown groups sort weekday numerically, length by the bucket order above, and month/year chronologically. Room, stakes, kind and variant groups sort by entry count descending, then label and key.

## 14. `ringGame`

`RingGame = {id,roomId:Id|null,name,defaultAssetId:Id|null,memo,archivedAt,currentRuleId,ruleVersion:CashRule,lineups:LineupMap,createdAt,updatedAt}`. Rule fields belong to ruleVersion, not duplicated top-level columns. Referenced masters cannot be hard-deleted; archive is reversible.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `listByRoom` Q | `{roomId,includeArchived?:boolean}` | RingGame[] | — | `ring_game_list_by_room` |
| `create` M | `{roomId,name:string 1..100,defaultAssetId?:Id|null,memo?:string<=50000|null,rule:CashRuleInput}` | RingGame | Invalid range/structure: BAD_REQUEST | `ring_game_create` |
| `update` M | `{id,name?,defaultAssetId?:Id|null,memo?:string<=50000|null,rule?:CashRuleInput}` | RingGame | Invalid resulting range: BAD_REQUEST | `ring_game_update` |
| `restoreRule` M | `{id,ruleVersionId:Id}` | RingGame | Version must belong to this master: BAD_REQUEST; archived master/version allowed | Excluded: screen |
| `archive` M | IdInput | RingGame | — | `ring_game_archive` |
| `restore` M | IdInput | RingGame | — | `ring_game_restore` |
| `delete` M | IdInput | Ack | Entry links or version use: CONFLICT, archive instead | Excluded: destructive |

`ringGame.restoreRule` points currentRuleId to an existing version of that master without creating a version, even when archived. It is the inverse of `update{rule}`.

## 15. `tournament`

`Tournament = {id,roomId:Id|null,name,defaultAssetId:Id|null,memo,archivedAt,currentRuleId,ruleVersion:TournamentRule,lineups:LineupMap,tags:{id,name}[],createdAt,updatedAt}`. Get/list both return the complete version, levels and prices.

`TournamentCreate = {roomId,name:trimmed string 1..100,defaultAssetId?:Id|null,memo?:string|null,tagIds?:Id[],rule:TournamentRuleInput}`. `TournamentUpdate = {id,name?,defaultAssetId?:Id|null,memo?:string|null,tagIds?:Id[],rule?:TournamentRuleInput}`. Memo is at most 50,000 characters. Tags are ids, not names. Structures and prices are whole-version writes; omitted collections carry forward on update. `updateWithLevels` requires `rule.levels` and replaces it as a whole, while prices change only when supplied.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `listByRoom` Q | `{roomId,includeArchived?:boolean}` | Tournament[] | — | `tournament_list_by_room` |
| `getById` Q | IdInput | Tournament | — | `tournament_get_by_id` |
| `create` M | TournamentCreate | Tournament | Invalid structure/price: BAD_REQUEST | Excluded: narrower structure workflow |
| `update` M | TournamentUpdate | Tournament | Invalid merged rule: BAD_REQUEST | Excluded: narrower structure workflow |
| `createWithLevels` M | TournamentCreate with `rule.levels` required (may be empty) | Tournament | Invalid structure/price: BAD_REQUEST | `tournament_create_with_levels` |
| `updateWithLevels` M | TournamentUpdate with `rule.levels` required | Tournament | Invalid merged rule: BAD_REQUEST | `tournament_update_with_levels` |
| `restoreRule` M | `{id,ruleVersionId:Id}` | Tournament | Version must belong to this master: BAD_REQUEST; archived master/version allowed | Excluded: screen |
| `archive` M | IdInput | Tournament | — | `tournament_archive` |
| `restore` M | IdInput | Tournament | — | `tournament_restore` |
| `delete` M | IdInput | Ack | Entry links/version/price use: CONFLICT, archive instead | Excluded: destructive |

`create/update` accept the same TournamentRuleInput, including `levels` and `prices`. MCP exposes only the WithLevels pair because it requires `rule.levels`, so a tool call cannot silently carry forward a structure. Every call writes at most one resulting immutable rule version.

`tournament.restoreRule` points currentRuleId to an existing version of that master without creating a version, even when archived. It is the inverse of `update{rule}` / `updateWithLevels{rule}`.

## 16. `gameGroup`

`GameGroup = {id,userId,label,blind1Label,blind2Label,blind3Label,blind1Required:boolean,blind2Required:boolean,blind3Required:boolean,fixedAnteType:'none'|'all'|'bb'|null,builtinKey,archivedAt,createdAt,updatedAt}`. Label trimmed 1–30 characters; blind labels nullable, trimmed 1–20. Case-insensitive trimmed label uniqueness is within this master kind. Archived rows keep their label reservation.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | GameGroup[] | — | `game_group_list` |
| `create` M | `{label,blind1Label?,blind2Label?,blind3Label?,blind1Required?:boolean=false,blind2Required?:boolean=false,blind3Required?:boolean=false,fixedAnteType?:'none'|'all'|'bb'|null=null}` | GameGroup | Duplicate: CONFLICT; Required field without a label: BAD_REQUEST | `game_group_create` |
| `update` M | `{id,label?,blind1Label?:string|null,blind2Label?:string|null,blind3Label?:string|null,blind1Required?:boolean,blind2Required?:boolean,blind3Required?:boolean,fixedAnteType?:'none'|'all'|'bb'|null}` | GameGroup | Duplicate or clearing a label with stored stake values: CONFLICT; Required field without a label: BAD_REQUEST | `game_group_update` |
| `archive` M | IdInput | GameGroup | Active variants using group: CONFLICT | `game_group_archive` |
| `restore` M | IdInput | GameGroup | — | `game_group_restore` |
| `delete` M | IdInput | Ack | Variants or lineup groups reference it: CONFLICT, archive instead | Excluded: destructive |

Only labeled blind fields may be Required; validate the merged group on create/update (`BAD_REQUEST`). User-created groups default all three flags to false (Optional). Clearing a blind label while any saved stake still has a value in that field is `CONFLICT`. Stake writes follow §2; existing version reuse is exempt, not newly written rows. Ante is unaffected by the Required flags. `fixedAnteType` (null = chosen per stake) can be set on builtin and user groups alike; omitted on update keeps it, null clears it, and a change never rewrites saved stakes (§2).

Builtin defaults: Limit requires Small Bet and Big Bet; Stud requires Small Bet and Big Bet, with Bring-in Optional. Big Bet has only SB and BB, both Required. Stud fixes the ante type to `all`; Limit and Big Bet leave it null.

## 17. `gameVariant`

`GameVariant = {id,userId,label,shortLabel,groupId,builtinKey,sortOrder,archivedAt,createdAt,updatedAt}`. Label 1–30 trimmed; shortLabel nullable 1–15 trimmed. Moving a variant's group changes future lineups only; immutable historical lineup groups retain their structure. Renaming changes current display labels, not composition ids.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | GameVariant[] | — | `game_variant_list` |
| `create` M | `{label,shortLabel?,groupId}` | GameVariant | Duplicate within variant namespace: CONFLICT; archived group: BAD_REQUEST; a mix may share the label | `game_variant_create` |
| `update` M | `{id,label?,shortLabel?:string|null,groupId?,sortOrder?:nonnegative integer}` | GameVariant | Duplicate: CONFLICT; archived new group: BAD_REQUEST | `game_variant_update` |
| `archive` M | IdInput | GameVariant | Used by active mix: CONFLICT | `game_variant_archive` |
| `restore` M | IdInput | GameVariant | Archived group: BAD_REQUEST | `game_variant_restore` |
| `delete` M | IdInput | Ack | Referenced anywhere: CONFLICT, archive instead | Excluded: destructive |

## 18. `gameMix`

`GameMix = {id,userId,label,builtinKey,archivedAt,games:Id[],createdAt,updatedAt}`. A mix is an unordered set of games; `games` comes back in the canonical order the server saved: game-group list order (built-ins first, then by label), then variant list order (`sortOrder`, label, id) within a group, regardless of the order sent. Labels 1–30 trimmed; the label namespace guard is defined by [data model](data-model.md) §5.2. Games: 2–60 unique owned ids spanning at most 12 groups. One mix per set of games per user: a create or games update whose set another mix holds, archived and built-in included, is `CONFLICT` "Same games as <label>". Update may retain an archived member already in the mix, but cannot add a newly selected archived member.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | GameMix[] | — | `game_mix_list` |
| `create` M | `{label,games:Id[]}` | GameMix | Duplicate label or same set of games: CONFLICT; archived/duplicate members: BAD_REQUEST | `game_mix_create` |
| `update` M | `{id,label?,games?:Id[]}` | GameMix | Same; supplied games replaces the complete set | `game_mix_update` |
| `archive` M | IdInput | GameMix | — | `game_mix_archive` |
| `restore` M | IdInput | GameMix | Archived member: BAD_REQUEST | `game_mix_restore` |
| `delete` M | IdInput | Ack | Referenced by lineup: CONFLICT, archive instead | Excluded: destructive |

Hard delete is guarded and available only for unreferenced game masters, alongside archive/restore; no MCP delete is exposed. New selections reject archived composition members; echoing an unchanged stored lineup keeps history valid.

## 19. `entryTag`

Created by `createTagRouter()`. `Tag = {id,name,position,createdAt,updatedAt}`; names trimmed 1–50, case-insensitively unique within user/kind. Common tag procedures below are instantiated per router; no cross-kind id is valid.

Deleting a tag may leave gaps in its stored sort order; the relative display order is unchanged. A subsequent reorder compacts the positions.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | none | Tag[] ordered position,id | — | `entry_tag_list` |
| `create` M | `{name:string 1..50}` | Tag | Duplicate: CONFLICT; more than 500 tags per user/kind: PRECONDITION_FAILED | `entry_tag_create` |
| `update` M | `{id,name:string 1..50}` | Tag | Duplicate: CONFLICT | Excluded: tag maintenance |
| `delete` M | IdInput | Ack; removes links, not entries | — | Excluded: destructive |
| `reorder` M | `{ids:Id[]}` unique complete permutation of owned tags of this kind, max 500 | Tag[] | Foreign/missing id: FORBIDDEN; incomplete/duplicate permutation: BAD_REQUEST; tag membership changed before write: CONFLICT | Excluded: screen ordering |

Entry attachment is entry.create/update tagIds; no separate toggle/addTag/removeTag procedures.

For entry, tournament and player create/update, `tagIds` are unique and limited to 100; omission leaves links unchanged on update, `[]` clears them, and a supplied list replaces all links in one batch. Foreign or missing tag ids return FORBIDDEN.

## 20. `tournamentTag`

Same Tag shape and all five procedures/inputs/errors as §19, instantiated as `tournamentTag.list/create/update/delete/reorder`. Outputs respectively Tag[], Tag, Tag, Ack, Tag[]. MCP `tournament_tag_list`, `tournament_tag_create`; update/reorder excluded tag maintenance/screen ordering, delete excluded destructive. Attachment is tournament create/update/WithLevels tagIds, complete replacement. No name-based attachment.

## 21. `handTag`

Same five Tag procedures, shapes, constraints and errors as §19, instantiated as `handTag.list/create/update/delete/reorder`. MCP `hand_tag_list`, `hand_tag_create`; update/reorder excluded tag maintenance/screen ordering, delete excluded destructive. hand.list/getById return `tags: {id,name,reviewedAt}[]`. hand.update accepts `tagIds` and `tagReviews?:{tagId:Id,reviewedAt:Instant|null}[]`; foreign or missing tags return FORBIDDEN, and an owned but unattached review tag returns BAD_REQUEST. Without `tagIds`, reviews apply to the current attachments.

## 22. `playerTag`

Same five procedures as §19, instantiated as `playerTag.list/create/update/delete/reorder`. `PlayerTag = Tag & {color:TagColor}`. Create additionally accepts `color?:TagColor='gray'`; update accepts optional name/color, at least one. TagColor is the shared `TAG_COLOR_NAMES` enum, not arbitrary CSS. Outputs use PlayerTag instead of Tag. MCP `player_tag_list`, `player_tag_create`; update excluded tag maintenance, reorder excluded screen ordering, delete excluded destructive. Player create/update tagIds order defines link position; deleting a tag deletes links, not players.

## 23. `player`

`Player = {id,userId,name,memo,isTemporary,isSelf,createdAt,updatedAt,tags:{id,name,color}[]}`. Names are trimmed 1–100; memo <=50,000. isSelf/isTemporary cannot be supplied to ordinary create/update. At most one self player exists per user; `getSelf` creates it if absent. The self player cannot be deleted; tablePlayer.addTemporary owns temporary creation.

Opponent name search uses SQLite `lower()`, which folds ASCII case only; it does not perform Unicode case folding.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{search?:string<=100,tagIds?:Id[]}` | Player[], excludes temporary/self; search is an ASCII case-insensitive literal substring and tags match any | More than 100 tag ids or duplicates: BAD_REQUEST (`tagIds must not repeat a tag` for duplicates) | `player_list` |
| `getById` Q | IdInput | Player, including self or temporary players | — | Excluded: opponent maintenance |
| `getSelf` Q | none | Player with isSelf:true | — | Excluded: cockpit identity |
| `create` M | `{name,memo?:string,tagIds?:Id[]}` | Player | — | Excluded: opponent maintenance |
| `update` M | `{id,name?,memo?:string|null,tagIds?:Id[]}` | Player | — | Excluded: opponent maintenance |
| `delete` M | IdInput | Ack | Referenced hand_seat, player_join/player_leave play event, or self row: CONFLICT | Excluded: destructive |
| `hands` Q | `{id,dateFrom?:DateOnly,dateTo?:DateOnly,...PageInput}` | Page<Hand & {seats:Seat[],actions:Action[]}> | Self as opponent target: BAD_REQUEST | Excluded: opponent review |
| `handStats` Q | `{id,dateFrom?:DateOnly,dateTo?:DateOnly}` | `{handCount,fullHandCount,vpipOpportunities,vpipCount,vpip:number|null,pfrOpportunities,pfrCount,pfr:number|null}` | Self as opponent target: BAD_REQUEST | Excluded: opponent review |

Opponent full-hand denominators and VPIP/PFR follow [statistics](statistics.md); rates are percentages and count/summary hands are not fabricated action observations. Date filters resolve the hand's parent play local date. Pagination for player.hands orders `(playedAt,id)` descending with null times last; its cursor is scoped to the player and date filters. Reversed date ranges are BAD_REQUEST.

## 24. `room`

`Room = {id,userId,name,memo,latitude,longitude,isFavorite,archivedAt,createdAt,updatedAt}`. The list additionally returns active `ringGameCount`, `tournamentCount` and `isReferenced`. Coordinates must be supplied or cleared together, latitude [-90,90], longitude [-180,180]. Name is trimmed 1–100; memo <=50,000. No API fetches arbitrary user URLs to populate a room.

| Procedure | Input | Output | Additional errors | MCP |
| --- | --- | --- | --- | --- |
| `list` Q | `{includeArchived?:boolean}` | Room[] ordered favorite first, then createdAt ascending | — | `room_list` |
| `getById` Q | IdInput | Room | — | `room_get_by_id` |
| `create` M | `{name:trimmed string 1..100,memo?:string<=50000,latitude?:number|null,longitude?:number|null}` | Room | Coordinate mismatch: BAD_REQUEST | `room_create` |
| `update` M | `{id,name?,memo?:string|null,latitude?:number|null,longitude?:number|null}` | Room | Coordinate mismatch: BAD_REQUEST | `room_update` |
| `archive` M | IdInput | Room | — | `room_archive` |
| `restore` M | IdInput | Room | — | `room_restore` |
| `delete` M | IdInput | Ack | Any entry or ringGame/tournament reference: CONFLICT, archive instead | Excluded: destructive |
| `toggleFavorite` M | IdInput | Room | — | Excluded: toggle |

## 25. `location`

Both are mutations and do not create rooms. `search` uses Google Places quota; `resolveLink` is a screen workflow that can fetch Google Maps short links. Both are excluded from MCP.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `search` M | `{query:string 1..200}` | Up to five `{name,address,latitude,longitude}` results | Missing provider key/provider failure: INTERNAL_SERVER_ERROR |
| `resolveLink` M | `{url:valid URL string}` | `{latitude:number,longitude:number}` | Invalid Maps link, redirect or missing coordinates: BAD_REQUEST; short-link network failure: INTERNAL_SERVER_ERROR |

Accepted links use HTTPS without credentials or nondefault ports and have a Google host matching the server allowlist, or the short hosts `maps.app.goo.gl` and `goo.gl`. Only short links are fetched, with at most five redirects; every redirect host is checked. Coordinates are parsed from the resulting URL.

## 26. `filterPreset`

All **Excluded: screen**. `Preset = {id,userId,screenKey:'sessions'|'statistics',name,payload,isDefault,createdAt,updatedAt}`. Name is trimmed to 1–50 characters; duplicate checks within user/screen use SQLite `NOCASE`, which folds ASCII case only, not Unicode case.

Payload keys: `period?:string` (1–30 characters; client date-range shortcut), `dateFrom?:DateOnly,dateTo?:DateOnly,kind?:cash|tournament,roomId?:Id,assetId?:Id,valuation?:real|virtual,baseAssetId?:Id,normalized?:boolean,entryTagIds?:Id[],tournamentTagIds?:Id[]`. Unknown keys are rejected; tag arrays are unique and capped at 100. Date ranges must be ordered. Statistics requires exactly one stats mode; sessions may omit it. Updating payload replaces it in full and validates it against the preset's immutable screen key. Setting a default clears the previous default within that screen in one batch.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | `{screenKey:sessions|statistics}` | Preset[] ordered default first, then createdAt ascending | Invalid stored payload: INTERNAL_SERVER_ERROR |
| `create` M | `{screenKey,name,payload}` | Preset | Duplicate name: CONFLICT |
| `update` M | `{id,name?,payload?}` | Preset | Duplicate name: CONFLICT; invalid replacement payload: BAD_REQUEST |
| `delete` M | IdInput | Ack | — |
| `setDefault` M | IdInput | Preset | — |
| `clearDefault` M | IdInput | Preset | — |

Converted-mode keys and both tag filters persist unchanged on save/read. Payload is stored as valid JSON.

## 27. `updateNoteView`

All **Excluded: screen** (read tracking). `View = {id,userId,version,viewedAt}`.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `list` Q | none | View[] newest viewedAt first | — |
| `markViewed` M | `{version:string 1..100}` | View | — |

Mark is idempotent per user/version and never duplicates a view on retries.

## 28. `aiExtract`

Both **Excluded: extraction**: MCP clients can interpret images themselves. Inputs share `sources:{kind:'image',data:nonempty base64 string,mediaType:image/jpeg|image/png|image/gif|image/webp}[]`, length 1–5. These procedures return **untrusted extraction suggestions**, not persisted rules/payments; callers choose owned asset/game/tag ids before writing.

| Procedure | Input | Output | Additional errors |
| --- | --- | --- | --- |
| `extractTournamentData` M | `{sources}` | `{name?,buyIn?:nonnegative integer,entryFee?:nonnegative integer,startingStack?:nonnegative integer,tableSize?:2..10,chipPurchases?:{name,cost,chips}[],blindLevels?:{isBreak,minutes?,blind1?,blind2?,blind3?,ante?}[]}`; absent unknown fields | Missing key, truncated/missing/invalid structured response: INTERNAL_SERVER_ERROR |
| `extractTablePlayers` M | `{sourceApp:'dmm_waitinglist',sources}` | `{seats:{seatNumber:integer 1..10,name:nonempty string,isHero:boolean|null}[]}`; duplicate seat numbers deduplicated | Same provider errors |

## 29. Root infrastructure

`healthCheck` Q: no input, output literal `"OK"`, public; MCP **Excluded: infrastructure**.

## 30. MCP tool map

Each row is an exact registry mapping; a comma-separated tool list corresponds positionally to the procedure list. All other procedures above are present in `DELIBERATELY_EXCLUDED` with their stated reasons. Handlers call `appRouter.createCaller`, never the database. JSON is returned untrimmed; errors pass through mapToolError, whose forbidden/not-found texts are fixed and id-free.

| Tool name | Procedure |
| --- | --- |
| entry_list | entry.list |
| entry_get_by_id | entry.getById |
| entry_create_cash | entry.create (kind cash branch) |
| entry_create_tournament | entry.create (kind tournament branch) |
| entry_update | entry.update |
| stats_summary | stats.summary |
| stats_breakdown | stats.breakdown |
| stats_profit_loss_series | stats.profitLossSeries |
| asset_list | asset.list |
| asset_rate_list | assetRate.list |
| user_setting_get | userSetting.get |
| hand_list | hand.list |
| hand_get_by_id | hand.getById |
| room_list, room_get_by_id | room.list, room.getById |
| room_create, room_update | room.create, room.update |
| room_archive, room_restore | room.archive, room.restore |
| ring_game_list_by_room | ringGame.listByRoom |
| ring_game_create, ring_game_update | ringGame.create, ringGame.update |
| ring_game_archive, ring_game_restore | ringGame.archive, ringGame.restore |
| tournament_list_by_room, tournament_get_by_id | tournament.listByRoom, tournament.getById |
| tournament_create_with_levels, tournament_update_with_levels | tournament.createWithLevels, tournament.updateWithLevels |
| tournament_archive, tournament_restore | tournament.archive, tournament.restore |
| game_group_list, game_group_create, game_group_update | gameGroup.list, gameGroup.create, gameGroup.update |
| game_group_archive, game_group_restore | gameGroup.archive, gameGroup.restore |
| game_variant_list, game_variant_create, game_variant_update | gameVariant.list, gameVariant.create, gameVariant.update |
| game_variant_archive, game_variant_restore | gameVariant.archive, gameVariant.restore |
| game_mix_list, game_mix_create, game_mix_update | gameMix.list, gameMix.create, gameMix.update |
| game_mix_archive, game_mix_restore | gameMix.archive, gameMix.restore |
| entry_tag_list, entry_tag_create | entryTag.list, entryTag.create |
| tournament_tag_list, tournament_tag_create | tournamentTag.list, tournamentTag.create |
| hand_tag_list, hand_tag_create | handTag.list, handTag.create |
| player_tag_list, player_tag_create | playerTag.list, playerTag.create |
| player_list | player.list |

Restore operations for Undo are deliberately excluded from MCP:

| MCP status | Procedure |
| --- | --- |
| Excluded: screen | entry.restoreRule, live.restoreRule |
| Excluded: screen | ringGame.restoreRule |
| Excluded: screen | tournament.restoreRule |

Each union branch tool uses the router's exact branch schema object. Tool descriptions state array replacement, archive recovery, date/quantity units and cross-field constraints. Creates and `entry_update` are annotated non-idempotent; archive/restore are idempotent and non-destructive. No delete or toggle tool is exposed.
