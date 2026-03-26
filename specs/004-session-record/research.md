# Research: Session Post-Recording

## Decision 1: Single Table with Type Discriminator vs. Separate Tables

**Decision**: Single `session` table with a `type` text column (`cash_game` | `tournament`) and nullable type-specific fields.

**Rationale**: The existing codebase uses single tables for each entity (ringGame, tournament). Session shares many common fields (userId, storeId, currencyId, date, memo, timestamps). A discriminator column keeps queries simple (one table scan for the session list with mixed types) and avoids JOINs for the most common operation (listing all sessions).

**Alternatives considered**:
- Two separate tables (`cashGameSession`, `tournamentSession`): Would require UNION queries for the combined session list, complicate pagination, and duplicate common column definitions. Rejected for added complexity.
- Polymorphic table with JSON blob for type-specific fields: Loses type safety and query-ability at the DB level. Rejected.

## Decision 2: Currency Transaction Auto-generation Approach

**Decision**: Add a nullable `sessionId` foreign key to the existing `currencyTransaction` table to link auto-generated transactions back to their source session. Use a dedicated `transactionType` named "Session Result" (auto-seeded) for session-generated transactions.

**Rationale**: The existing `currencyTransaction` table already has `transactionTypeId` for categorization and `memo` for context. Adding a `sessionId` FK is the minimal change to enable: (1) identifying session-generated transactions, (2) enforcing read-only behavior on the currency page, (3) cascading deletes when a session is deleted. A dedicated transactionType makes filtering straightforward.

**Alternatives considered**:
- Boolean flag `isSessionGenerated` on currencyTransaction: Less queryable, no direct link back to the session for navigation. Rejected.
- Separate table `sessionTransaction`: Adds redundancy with currencyTransaction and requires separate balance calculation logic. Rejected.

## Decision 3: Summary Statistics Calculation

**Decision**: Calculate summary statistics on-the-fly via SQL aggregation queries. No materialized view or separate aggregation table.

**Rationale**: At the expected scale (hundreds of sessions per user, not millions), aggregate queries over a single indexed table are fast enough. The existing currency balance pattern already uses `COALESCE(SUM(...), 0)` in the list query. Adding WHERE clauses for filters (type, storeId, date range) leverages indexes.

**Alternatives considered**:
- Materialized summary table updated on each mutation: Premature optimization, adds write complexity and consistency risk. Rejected per YAGNI principle.

## Decision 4: Cursor Pagination for Session List

**Decision**: Use cursor-based pagination on `sessionDate` (descending) with `id` as tie-breaker, following the existing `currencyTransaction.listByCurrency` pattern.

**Rationale**: Consistent with established project patterns. Cursor pagination is more reliable than offset for lists that change frequently (new sessions added).

**Alternatives considered**:
- Offset pagination: Simpler but can skip/duplicate items when data changes between pages. Not used elsewhere in the project. Rejected for consistency.

## Decision 5: Session Form UI Pattern

**Decision**: Two-step form: (1) select session type (cash game / tournament), (2) show type-specific form fields. Use ResponsiveDialog (drawer on mobile, dialog on desktop) consistent with existing form patterns.

**Rationale**: The type selection must happen first because it determines which fields are shown. Existing forms (ring-game-form, tournament-form) use the ResponsiveDialog pattern with FormData API. The session form follows the same pattern but adds type-conditional rendering.

**Alternatives considered**:
- Single form with all fields, hiding irrelevant ones: More complex state management, confusing UX with many hidden fields. Rejected.
- Separate routes for cash game vs tournament session creation: Adds navigation complexity for a single-entity operation. Rejected.
