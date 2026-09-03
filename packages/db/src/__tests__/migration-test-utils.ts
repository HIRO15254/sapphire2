import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe } from "vitest";

// biome-ignore lint/correctness/noUndeclaredVariables: Bun is a runtime global
export const isBun = typeof Bun !== "undefined";
export const skipIfNotBun = isBun ? describe : describe.skip;

export interface SqliteLike {
	exec: (sql: string) => unknown;
}

const STATEMENT_BREAKPOINT = "--> statement-breakpoint";
const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const FOREIGN_KEYS_PRAGMA = "PRAGMA foreign_keys=";

export function splitStatements(sql: string): string[] {
	return sql
		.split(STATEMENT_BREAKPOINT)
		.map((statement) => statement.trim())
		.filter(Boolean);
}

export function applyStatements(db: SqliteLike, statements: string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

export function applyThrough(
	db: SqliteLike,
	statements: string[],
	marker: string
): void {
	const cut = statements.findIndex((statement) => statement.includes(marker));
	if (cut < 0) {
		throw new Error(`no migration statement matches ${marker}`);
	}
	applyStatements(db, statements.slice(0, cut + 1));
}

export function applyAsD1Migration(db: SqliteLike, sql: string): void {
	applyStatements(
		db,
		splitStatements(sql).filter(
			(statement) => !statement.startsWith(FOREIGN_KEYS_PRAGMA)
		)
	);
}

export function listMigrationFiles(migrationsDirectory: string): string[] {
	return readdirSync(migrationsDirectory)
		.filter((filename) => MIGRATION_FILE_PATTERN.test(filename))
		.toSorted();
}

export function applyCompleteMigrationHistory(
	db: SqliteLike,
	migrationsDirectory: string
): void {
	for (const filename of listMigrationFiles(migrationsDirectory)) {
		applyAsD1Migration(
			db,
			readFileSync(join(migrationsDirectory, filename), "utf8")
		);
	}
}

export function readMigrationByPrefix(
	migrationsDirectory: string,
	prefix: string
): string {
	const filename = listMigrationFiles(migrationsDirectory).find((name) =>
		name.startsWith(`${prefix}_`)
	);
	if (!filename) {
		throw new Error(`migration ${prefix} is missing`);
	}
	return readFileSync(join(migrationsDirectory, filename), "utf8");
}
