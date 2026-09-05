import type { Database } from "@sapphire2/db";

type DbInstance = Database;

export type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

export const D1_MAX_BOUND_PARAMS = 100;

export function chunkForInsert<T>(rows: T[], columnsPerRow: number): T[][] {
	const perChunk = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnsPerRow));
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += perChunk) {
		chunks.push(rows.slice(i, i + perChunk));
	}
	return chunks;
}

export async function runBatch(
	db: DbInstance,
	statements: BatchStatement[]
): Promise<void> {
	if (statements.length === 0) {
		return;
	}
	await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
}
