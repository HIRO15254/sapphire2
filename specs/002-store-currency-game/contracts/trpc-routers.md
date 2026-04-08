# tRPC Router Contracts: 002-store-currency-game

All procedures require `protectedProcedure`.
All mutations check ownership before changing data.

## store router

| Procedure | Type | Input | Output |
|---|---|---|---|
| store.list | query | - | `Store[]` |
| store.getById | query | `{ id: string }` | `Store` |
| store.create | mutation | `{ name: string, memo?: string }` | `Store` |
| store.update | mutation | `{ id: string, name?: string, memo?: string }` | `Store` |
| store.delete | mutation | `{ id: string }` | `{ success: true }` |

## currency router

| Procedure | Type | Input | Output |
|---|---|---|---|
| currency.list | query | - | `Currency[]` with `balance` |
| currency.create | mutation | `{ name: string, unit?: string }` | `Currency` |
| currency.update | mutation | `{ id: string, name?: string, unit?: string }` | `Currency` |
| currency.delete | mutation | `{ id: string }` | `{ success: true }` |

## transactionType router

| Procedure | Type | Input | Output |
|---|---|---|---|
| transactionType.list | query | - | `TransactionType[]` |
| transactionType.create | mutation | `{ name: string }` | `TransactionType` |
| transactionType.update | mutation | `{ id: string, name: string }` | `TransactionType` |
| transactionType.delete | mutation | `{ id: string }` | `{ success: true }` or error if in use |

## currencyTransaction router

| Procedure | Type | Input | Output |
|---|---|---|---|
| currencyTransaction.listByCurrency | query | `{ currencyId: string, cursor?: string }` | `{ items, nextCursor? }` |
| currencyTransaction.create | mutation | `{ currencyId: string, transactionTypeId: string, amount: number, transactedAt: string, memo?: string }` | `CurrencyTransaction` |
| currencyTransaction.update | mutation | `{ id: string, transactionTypeId?: string, amount?: number, transactedAt?: string, memo?: string \| null }` | `CurrencyTransaction` |
| currencyTransaction.delete | mutation | `{ id: string }` | `{ success: true }` |

## ringGame router

| Procedure | Type | Input | Output |
|---|---|---|---|
| ringGame.listByStore | query | `{ storeId: string, includeArchived?: boolean }` | `RingGame[]` |
| ringGame.create | mutation | `{ storeId: string, name: string, variant?: string, blind1?: number, blind2?: number, blind3?: number, ante?: number, anteType?: 'none' \| 'all' \| 'bb', minBuyIn?: number, maxBuyIn?: number, tableSize?: number, currencyId?: string, memo?: string }` | `RingGame` |
| ringGame.update | mutation | `{ id: string, ...partial fields above }` | `RingGame` |
| ringGame.archive | mutation | `{ id: string }` | `RingGame` |
| ringGame.restore | mutation | `{ id: string }` | `RingGame` |
| ringGame.delete | mutation | `{ id: string }` | `{ success: true }` |

## tournament router

| Procedure | Type | Input | Output |
|---|---|---|---|
| tournament.listByStore | query | `{ storeId: string, includeArchived?: boolean }` | `Tournament[]` with `blindLevelCount`, `tags`, `chipPurchases` |
| tournament.getById | query | `{ id: string }` | `Tournament` with `blindLevels`, `tags` |
| tournament.create | mutation | `{ storeId: string, name: string, variant?: string, buyIn?: number, entryFee?: number, startingStack?: number, bountyAmount?: number, tableSize?: number, currencyId?: string, memo?: string }` | `Tournament` |
| tournament.update | mutation | `{ id: string, ...partial fields above }` | `Tournament` |
| tournament.archive | mutation | `{ id: string }` | `Tournament` |
| tournament.restore | mutation | `{ id: string }` | `Tournament` |
| tournament.delete | mutation | `{ id: string }` | `{ success: true }` |
| tournament.addTag | mutation | `{ tournamentId: string, name: string }` | `TournamentTag` |
| tournament.removeTag | mutation | `{ id: string }` | `{ success: true }` |

## blindLevel router

| Procedure | Type | Input | Output |
|---|---|---|---|
| blindLevel.listByTournament | query | `{ tournamentId: string }` | `BlindLevel[]` ordered by level |
| blindLevel.create | mutation | `{ tournamentId: string, level: number, isBreak?: boolean, blind1?: number, blind2?: number, blind3?: number, ante?: number, minutes?: number }` | `BlindLevel` |
| blindLevel.update | mutation | `{ id: string, level?: number, isBreak?: boolean, blind1?: number \| null, blind2?: number \| null, blind3?: number \| null, ante?: number \| null, minutes?: number \| null }` | `BlindLevel` |
| blindLevel.delete | mutation | `{ id: string }` | `{ success: true }` |
| blindLevel.reorder | mutation | `{ tournamentId: string, levelIds: string[] }` | `BlindLevel[]` |

## tournamentChipPurchase router

| Procedure | Type | Input | Output |
|---|---|---|---|
| tournamentChipPurchase.listByTournament | query | `{ tournamentId: string }` | `TournamentChipPurchase[]` ordered by sortOrder |
| tournamentChipPurchase.create | mutation | `{ tournamentId: string, name: string, cost: number, chips: number }` | `TournamentChipPurchase` |
| tournamentChipPurchase.update | mutation | `{ id: string, name?: string, cost?: number, chips?: number }` | `TournamentChipPurchase` |
| tournamentChipPurchase.delete | mutation | `{ id: string }` | `{ success: true }` |
| tournamentChipPurchase.reorder | mutation | `{ tournamentId: string, ids: string[] }` | `TournamentChipPurchase[]` |

## Out of Scope

- Session-related routers exist in the appRouter, but they are outside this feature sync
