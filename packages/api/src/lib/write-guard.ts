import type { Database } from "@sapphire2/db";
import { writeGuard } from "@sapphire2/db/schema/write-guard";
import { TRPCError } from "@trpc/server";
import { type SQL, sql } from "drizzle-orm";
import { CONCURRENT_CHANGE_MESSAGE } from "../concurrent-change";
import { type BatchStatement, runBatch } from "./batch";
import { isWriteGuardError } from "./db-errors";

export function guardStatement(
	db: Database,
	name: string,
	condition: SQL
): BatchStatement {
	return db
		.insert(writeGuard)
		.select(sql`SELECT ${name} WHERE NOT coalesce((${condition}), 0)`);
}

export function changedRowsGuardStatement(
	db: Database,
	name: string
): BatchStatement {
	return db.insert(writeGuard).select(sql`SELECT ${name} WHERE changes() = 0`);
}

export async function withWriteGuardConflict<T>(
	run: () => Promise<T>,
	message = CONCURRENT_CHANGE_MESSAGE
): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (isWriteGuardError(error)) {
			throw new TRPCError({ code: "CONFLICT", message, cause: error });
		}
		throw error;
	}
}

export function runGuardedBatch(
	db: Database,
	statements: BatchStatement[],
	message = CONCURRENT_CHANGE_MESSAGE
): Promise<void> {
	return withWriteGuardConflict(() => runBatch(db, statements), message);
}
