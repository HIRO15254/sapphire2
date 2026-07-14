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
