import { TRPCError } from "@trpc/server";

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

const UNFINISHED_LIVE_SESSION_CONFLICT_RE =
	/UNIQUE constraint failed:\s*game_session\.user_id/i;
const SESSION_EVENT_ORDER_CONFLICT_RE =
	/UNIQUE constraint failed:\s*session_event\.session_id,\s*session_event\.sort_order/i;

/**
 * The `(user_id, screen_key, name)` UNIQUE index on `filter_preset` — the
 * app-level pre-check in filter-preset.ts's `create`/`update` races a
 * concurrent identical write (TOCTOU, same shape as the game_group label
 * guard above); this is the backstop that converts the resulting D1 error
 * into the same CONFLICT the pre-check throws.
 */
const FILTER_PRESET_NAME_CONFLICT_RE =
	/UNIQUE constraint failed:\s*filter_preset\./i;

export function isSessionEventOrderConflictError(error: unknown): boolean {
	return (
		error instanceof Error &&
		SESSION_EVENT_ORDER_CONFLICT_RE.test(error.message)
	);
}

export function isUnfinishedLiveSessionConflictError(error: unknown): boolean {
	return (
		error instanceof Error &&
		UNFINISHED_LIVE_SESSION_CONFLICT_RE.test(error.message)
	);
}

export function isLabelConflictError(error: unknown): boolean {
	return error instanceof Error && LABEL_CONFLICT_RE.test(error.message);
}

export function isFilterPresetNameConflictError(error: unknown): boolean {
	return (
		error instanceof Error && FILTER_PRESET_NAME_CONFLICT_RE.test(error.message)
	);
}

export const ACTIVE_SESSION_CONFLICT_MESSAGE =
	"Another session is already active";

export async function runUnfinishedLiveSessionWrite(
	operation: () => Promise<unknown>
): Promise<void> {
	try {
		await operation();
	} catch (error) {
		if (
			isUnfinishedLiveSessionConflictError(error) ||
			isSessionEventOrderConflictError(error)
		) {
			throw new TRPCError({
				code: "CONFLICT",
				message: ACTIVE_SESSION_CONFLICT_MESSAGE,
			});
		}
		throw error;
	}
}
