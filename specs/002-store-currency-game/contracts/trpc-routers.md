# tRPC Router Contracts: 002-store-currency-game

All procedures use `protectedProcedure` (authentication required).
All mutations validate ownership (userId match) before modifying data.

## store router

| Procedure     | Type     | Input                                | Output                    |
|---------------|----------|--------------------------------------|---------------------------|
| store.list    | query    | (none)                               | Store[]                   |
| store.getById | query    | `{ id: string }`                     | Store with counts         |
| store.create  | mutation | `{ name: string, memo?: string }`    | Store                     |
| store.update  | mutation | `{ id, name?, memo? }`               | Store                     |
| store.delete  | mutation | `{ id: string }`                     | void (cascade deletes)    |

## currency router

| Procedure              | Type     | Input                                          | Output                    |
|------------------------|----------|-------------------------------------------------|---------------------------|
| currency.listByStore   | query    | `{ storeId: string }`                           | Currency[] with balance   |
| currency.create        | mutation | `{ storeId, name, unit? }`                      | Currency                  |
| currency.update        | mutation | `{ id, name?, unit? }`                          | Currency                  |
| currency.delete        | mutation | `{ id: string }`                                | void (cascade txns)       |

## transactionType router

| Procedure                   | Type     | Input                     | Output                    |
|-----------------------------|----------|---------------------------|---------------------------|
| transactionType.list        | query    | (none)                    | TransactionType[]         |
| transactionType.create      | mutation | `{ name: string }`        | TransactionType           |
| transactionType.update      | mutation | `{ id, name }`            | TransactionType           |
| transactionType.delete      | mutation | `{ id: string }`          | void (blocked if in use)  |

## currencyTransaction router

| Procedure                        | Type     | Input                                                    | Output                    |
|----------------------------------|----------|----------------------------------------------------------|---------------------------|
| currencyTransaction.listByCurrency | query  | `{ currencyId: string }`                                 | CurrencyTransaction[]     |
| currencyTransaction.create       | mutation | `{ currencyId, transactionTypeId, amount, transactedAt, memo? }` | CurrencyTransaction |
| currencyTransaction.delete       | mutation | `{ id: string }`                                         | void                      |

## ringGame router

| Procedure            | Type     | Input                                                       | Output                    |
|----------------------|----------|-------------------------------------------------------------|---------------------------|
| ringGame.listByStore | query    | `{ storeId: string, includeArchived?: boolean }`            | RingGame[]                |
| ringGame.create      | mutation | `{ storeId, name, variant, blind1?, blind2?, blind3?, ante?, minBuyIn?, maxBuyIn?, tableSize?, currencyId?, memo? }` | RingGame |
| ringGame.update      | mutation | `{ id, ...partial fields }`                                 | RingGame                  |
| ringGame.archive     | mutation | `{ id: string }`                                            | RingGame                  |
| ringGame.restore     | mutation | `{ id: string }`                                            | RingGame                  |
| ringGame.delete      | mutation | `{ id: string }`                                            | void                      |

## tournament router

| Procedure                | Type     | Input                                                       | Output                    |
|--------------------------|----------|-------------------------------------------------------------|---------------------------|
| tournament.listByStore   | query    | `{ storeId: string, includeArchived?: boolean }`            | Tournament[] with levels  |
| tournament.getById       | query    | `{ id: string }`                                            | Tournament with levels    |
| tournament.create        | mutation | `{ storeId, name, variant, buyIn?, entryFee?, startingStack?, rebuyAllowed, rebuyCost?, rebuyChips?, addonAllowed, addonCost?, addonChips?, bountyAmount?, tableSize?, currencyId?, memo? }` | Tournament |
| tournament.update        | mutation | `{ id, ...partial fields }`                                 | Tournament                |
| tournament.archive       | mutation | `{ id: string }`                                            | Tournament                |
| tournament.restore       | mutation | `{ id: string }`                                            | Tournament                |
| tournament.delete        | mutation | `{ id: string }`                                            | void (cascade levels)     |

## blindLevel router (nested under tournament)

| Procedure                   | Type     | Input                                                    | Output                    |
|-----------------------------|----------|----------------------------------------------------------|---------------------------|
| blindLevel.listByTournament | query    | `{ tournamentId: string }`                               | BlindLevel[] (ordered)    |
| blindLevel.create           | mutation | `{ tournamentId, level, isBreak?, blind1?, blind2?, blind3?, ante?, minutes? }` | BlindLevel |
| blindLevel.update           | mutation | `{ id, level?, isBreak?, blind1?, blind2?, blind3?, ante?, minutes? }` | BlindLevel            |
| blindLevel.delete           | mutation | `{ id: string }`                                         | void                      |
| blindLevel.reorder          | mutation | `{ tournamentId, levelIds: string[] }`                   | BlindLevel[]              |
