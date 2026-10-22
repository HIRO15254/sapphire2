import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DatabaseSync,
	type SQLOutputValue,
	type StatementSync,
} from "node:sqlite";
import { fileURLToPath } from "node:url";

export type Database = DatabaseSync;
export type SqliteRow = Record<string, SQLOutputValue>;

export const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);
const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;

export function openDatabase(path = ":memory:"): Database {
	return new DatabaseSync(path, { enableForeignKeyConstraints: false });
}

export function migrationFiles(before?: string): string[] {
	return readdirSync(migrationsDirectory)
		.filter(
			(name) => MIGRATION_FILE_PATTERN.test(name) && (!before || name < before)
		)
		.toSorted();
}

export function migrationStatements(sql: string): string[] {
	return sql
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(
			(statement) => statement && !statement.startsWith("PRAGMA foreign_keys=")
		);
}

export function statementsOf(name: string): string[] {
	return migrationStatements(
		readFileSync(join(migrationsDirectory, name), "utf8")
	);
}

export function rowValues(statement: StatementSync): SQLOutputValue[][] {
	statement.setReturnArrays(true);
	const rows: (SqliteRow | SQLOutputValue[])[] = statement.all();
	return rows as SQLOutputValue[][];
}

export function stringValue(value: SQLOutputValue | undefined): string {
	if (typeof value !== "string") {
		throw new Error("Expected a SQLite text value");
	}
	return value;
}
