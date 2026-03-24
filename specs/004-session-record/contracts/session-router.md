# tRPC Router Contract: Session

## `session.list`

**Type**: Query (protectedProcedure)

**Input**:
```typescript
{
  type?: "cash_game" | "tournament"  // filter by session type
  storeId?: string                    // filter by store
  dateFrom?: number                   // unix timestamp, inclusive
  dateTo?: number                     // unix timestamp, inclusive
  cursor?: string                     // pagination cursor (session ID)
}
```

**Output**:
```typescript
{
  items: Array<{
    id: string
    type: "cash_game" | "tournament"
    sessionDate: Date
    profitLoss: number               // computed: cashOut - buyIn (cash) or prize - cost (tournament)
    evProfitLoss: number | null      // computed: evCashOut - buyIn (cash game only, when evCashOut set)
    evDiff: number | null            // computed: evProfitLoss - profitLoss
    storeId: string | null
    storeName: string | null         // JOIN resolved
    ringGameId: string | null
    ringGameName: string | null      // JOIN resolved
    tournamentId: string | null
    tournamentName: string | null    // JOIN resolved
    currencyId: string | null
    currencyName: string | null      // JOIN resolved
    startedAt: Date | null
    endedAt: Date | null
    memo: string | null
    createdAt: Date
  }>
  nextCursor: string | undefined
  summary: {
    totalSessions: number
    totalProfitLoss: number
    winRate: number                  // percentage (0-100)
    avgProfitLoss: number
    // Tournament-specific (included when type filter = "tournament")
    avgPlacement?: number
    totalPrizeMoney?: number
    itmRate?: number                 // percentage (0-100)
    // EV metrics (included when cash game sessions with EV data exist in result set)
    totalEvProfitLoss?: number
    totalEvDiff?: number
  }
}
```

---

## `session.getById`

**Type**: Query (protectedProcedure)

**Input**:
```typescript
{ id: string }
```

**Output**: Full session record with all fields + resolved entity names.

---

## `session.create`

**Type**: Mutation (protectedProcedure)

**Input**:
```typescript
{
  type: "cash_game" | "tournament"
  sessionDate: number                // unix timestamp
  // Links (all optional)
  storeId?: string
  ringGameId?: string               // only when type = cash_game; if omitted, auto-creates standalone ringGame from game config fields
  tournamentId?: string             // only when type = tournament
  currencyId?: string
  // Cash game fields (required when type = cash_game)
  buyIn?: number
  cashOut?: number
  evCashOut?: number
  // Ring game config fields (used to auto-create standalone ringGame when ringGameId not provided)
  variant?: string                   // defaults to "nlh"
  blind1?: number                    // SB
  blind2?: number                    // BB
  blind3?: number                    // Straddle
  ante?: number
  anteType?: "none" | "all" | "bb"
  tableSize?: number
  minBuyIn?: number
  maxBuyIn?: number
  // Tournament fields (buyIn + entryFee required when type = tournament)
  tournamentBuyIn?: number
  entryFee?: number
  placement?: number
  totalEntries?: number
  prizeMoney?: number
  rebuyCount?: number
  rebuyCost?: number
  addonCost?: number
  bountyPrizes?: number
  // Common optional
  startedAt?: number
  endedAt?: number
  memo?: string
}
```

**Output**: Created session record.

**Side effects**:
- If `ringGameId` is not provided and type is `cash_game`, creates a standalone `ringGame` (storeId=null) using the game config fields, and links it to the session.
- If `currencyId` is provided, creates a single `currencyTransaction` with the session's net P&L amount, linked via `sessionId`.

---

## `session.update`

**Type**: Mutation (protectedProcedure)

**Input**:
```typescript
{
  id: string
  // All fields from create (except type) as optional updates
  sessionDate?: number
  storeId?: string | null
  ringGameId?: string | null
  tournamentId?: string | null
  currencyId?: string | null
  buyIn?: number
  cashOut?: number
  evCashOut?: number | null
  // Ring game config fields (updates the linked ringGame)
  variant?: string
  blind1?: number | null
  blind2?: number | null
  blind3?: number | null
  ante?: number | null
  anteType?: "none" | "all" | "bb" | null
  tableSize?: number | null
  minBuyIn?: number | null
  maxBuyIn?: number | null
  tournamentBuyIn?: number
  entryFee?: number
  placement?: number | null
  totalEntries?: number | null
  prizeMoney?: number | null
  rebuyCount?: number | null
  rebuyCost?: number | null
  addonCost?: number | null
  bountyPrizes?: number | null
  startedAt?: number | null
  endedAt?: number | null
  memo?: string | null
}
```

**Output**: Updated session record.

**Side effects**:
- If currency changed: delete old transaction, create new one under new currency.
- If currency removed: delete auto-generated transaction.
- If currency unchanged but P&L amounts changed: update existing transaction amount.
- If currency added: create new transaction.

---

## `session.delete`

**Type**: Mutation (protectedProcedure)

**Input**:
```typescript
{ id: string }
```

**Output**: `{ success: true }`

**Side effects**:
- Auto-generated currency transaction is cascade-deleted via `sessionId` FK.
