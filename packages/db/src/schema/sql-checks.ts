import { type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

const ISO_DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";

export function oneOf(column: SQLiteColumn, values: readonly string[]): SQL {
	return sql`${column} IN (${sql.raw(values.map((value) => `'${value}'`).join(", "))})`;
}

export function isoDate(column: SQLiteColumn): SQL {
	return sql`${column} GLOB ${sql.raw(`'${ISO_DATE_GLOB}'`)}`;
}
