/**
 * A label collision on `game_group` / `game_variant` / `game_mix` surfaces in
 * TWO different shapes, and callers that react to it must recognize both:
 *
 *   1. The `(user_id, label)` UNIQUE indexes → a generic `Error` whose message
 *      contains `UNIQUE constraint failed` (e.g. `D1_ERROR: UNIQUE constraint
 *      failed: game_group.user_id, game_group.label: SQLITE_CONSTRAINT`).
 *   2. The migration-0041 BEFORE INSERT/UPDATE triggers, which
 *      `RAISE(ABORT, 'game master label already exists')` /
 *      `'game_group label already exists'`. SQLite evaluates a BEFORE trigger
 *      ahead of the unique index (and ahead of `ON CONFLICT` resolution), so in
 *      practice the trigger's custom message — NOT `UNIQUE constraint failed` —
 *      is the one that surfaces for any real duplicate.
 *
 * Used as the backstop when the app-level case-insensitive
 * `assertLabelNamespaceAvailable` check races a concurrent identical-label
 * write (c14, TOCTOU → CONFLICT), and when a losing concurrent seed batch must
 * be treated as a no-op (c09, seed-game-data). Matching only shape (1) let the
 * trigger-aborted race fall through to a 500 instead of the intended CONFLICT /
 * no-op — this helper closes that gap.
 */
const LABEL_CONFLICT_RE = /UNIQUE constraint failed|label already exists/i;

export function isLabelConflictError(error: unknown): boolean {
	return error instanceof Error && LABEL_CONFLICT_RE.test(error.message);
}
