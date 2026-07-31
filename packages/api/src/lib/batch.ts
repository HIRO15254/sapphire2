import type { Database } from "@sapphire2/db";

type DbInstance = Database;

/**
 * A single statement accepted by D1's `db.batch([...])` (a drizzle query
 * builder passed UN-awaited). Derived from the driver's own `batch` signature
 * so it tracks the installed drizzle version. Shared by session.ts and
 * seed-game-data.ts so this atomic-write helper has exactly one
 * implementation (c40) instead of two byte-identical copies.
 */
export type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

/**
 * D1 rejects any single statement binding more than 100 parameters. Lives here
 * rather than in session.ts so a service can size its own `IN (…)` list against
 * the same number without importing from a router (which would close an import
 * cycle: routers/session.ts already imports services/game-mix.ts).
 */
export const D1_MAX_BOUND_PARAMS = 100;

/**
 * Split rows so no single multi-row `INSERT` exceeds {@link D1_MAX_BOUND_PARAMS}
 * (an INSERT binds `columnsPerRow × rowCount` parameters). Re-exported from
 * routers/session.ts, which is where router-side callers import it from; it
 * lives here so services can use it without importing from a router (that would
 * close an import cycle).
 */
export function chunkForInsert<T>(rows: T[], columnsPerRow: number): T[][] {
	const perChunk = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnsPerRow));
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += perChunk) {
		chunks.push(rows.slice(i, i + perChunk));
	}
	return chunks;
}

/**
 * Commit a group of writes atomically. D1's `db.batch` requires a NON-EMPTY
 * tuple; an empty array is treated as a no-op (nothing to write). Every
 * caller builds its statements first, then hands the whole group to a single
 * `batch`, so a mid-sequence failure rolls the entire group back instead of
 * leaving a committed DELETE with its re-INSERT missing (SA2-116).
 */
export async function runBatch(
	db: DbInstance,
	statements: BatchStatement[]
): Promise<void> {
	if (statements.length === 0) {
		return;
	}
	await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}
