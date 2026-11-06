import type { Database } from "@sapphire2/db";

type DbInstance = Database;

export type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

export const D1_MAX_BOUND_PARAMS = 100;

export function chunkForInsert<T>(rows: T[], columnsPerRow: number): T[][] {
	if (rows.length === 0) {
		return [];
	}
	if (
		!Number.isInteger(columnsPerRow) ||
		columnsPerRow < 1 ||
		columnsPerRow > D1_MAX_BOUND_PARAMS
	) {
		throw new RangeError("columnsPerRow must be an integer from 1 to 100");
	}
	const perChunk = Math.floor(D1_MAX_BOUND_PARAMS / columnsPerRow);
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += perChunk) {
		chunks.push(rows.slice(i, i + perChunk));
	}
	return chunks;
}

export function insertChunks<Row extends Record<string, unknown>>(
	rows: Row[],
	insert: (chunk: Row[]) => BatchStatement
): BatchStatement[] {
	const first = rows[0];
	return first
		? chunkForInsert(rows, Object.keys(first).length).map(insert)
		: [];
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

export async function selectInChunks<Id, Row>(
	ids: Id[],
	run: (chunk: Id[]) => Promise<Row[]>,
	extraBoundParams = 0
): Promise<Row[]> {
	if (
		!Number.isInteger(extraBoundParams) ||
		extraBoundParams < 0 ||
		extraBoundParams >= D1_MAX_BOUND_PARAMS
	) {
		throw new RangeError(
			`extraBoundParams must be an integer from 0 to ${D1_MAX_BOUND_PARAMS - 1}`
		);
	}
	const rows: Row[] = [];
	const perChunk = D1_MAX_BOUND_PARAMS - extraBoundParams;
	for (let index = 0; index < ids.length; index += perChunk) {
		rows.push(...(await run(ids.slice(index, index + perChunk))));
	}
	return rows;
}
