import type { Database } from "@sapphire2/db";
import { sql } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { guardStatement } from "./write-guard";

type ActiveTable = SQLiteTable & {
	id: AnySQLiteColumn;
	userId: AnySQLiteColumn;
	archivedAt: AnySQLiteColumn;
};

export function activeReferenceGuard(
	db: Database,
	table: ActiveTable,
	id: string,
	userId: string
) {
	return guardStatement(
		db,
		"active reference",
		sql`EXISTS (
		SELECT 1 FROM ${table} WHERE ${table.id} = ${id}
		AND ${table.userId} = ${userId} AND ${table.archivedAt} IS NULL
	)`
	);
}

export function activeReferencesGuard(
	db: Database,
	table: ActiveTable,
	ids: Iterable<string>,
	userId: string
) {
	const values = JSON.stringify([...new Set(ids)]);
	return guardStatement(
		db,
		"active references",
		sql`NOT EXISTS (
		SELECT 1 FROM json_each(${values}) AS requested WHERE NOT EXISTS (
			SELECT 1 FROM ${table} WHERE ${table.id} = requested.value
			AND ${table.userId} = ${userId} AND ${table.archivedAt} IS NULL
		)
	)`
	);
}
