import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { parseArgs } from "node:util";

const USAGE = `usage: bun scripts/scrub-seed.ts --input <export.sql> --output <seed.sql> [--migrations <dir>]

Turns a data-only production D1 export into a seed for preview and dev databases (docs/deploy.md).
Exit 0: seed written. Exit 1: a table or column has no scrub decision, or the export failed to replay. Exit 2: usage.`;

export type ColumnRule = "keep" | { sql: string };
export type TableRule =
	| "drop"
	| "keep"
	| { columns: Readonly<Record<string, ColumnRule>> };

const NULL_VALUE = { sql: "NULL" } as const;

export const SCRUB_POLICY: Readonly<Record<string, TableRule>> = {
	account: {
		columns: {
			access_token: NULL_VALUE,
			access_token_expires_at: NULL_VALUE,
			account_id: "keep",
			created_at: "keep",
			id: "keep",
			id_token: NULL_VALUE,
			password: NULL_VALUE,
			provider_id: "keep",
			refresh_token: NULL_VALUE,
			refresh_token_expires_at: NULL_VALUE,
			scope: "keep",
			updated_at: "keep",
			user_id: "keep",
		},
	},
	asset: "keep",
	asset_rate: "keep",
	cash_rule: "keep",
	cash_rule_stake: "keep",
	entry: "keep",
	entry_cash: "keep",
	entry_tag: "keep",
	entry_tag_link: "keep",
	entry_tournament: "keep",
	filter_preset: "keep",
	game_group: "keep",
	game_lineup: "keep",
	game_lineup_group: "keep",
	game_lineup_variant: "keep",
	game_mix: "keep",
	game_mix_variant: "keep",
	game_variant: "keep",
	hand: "keep",
	hand_action: "keep",
	hand_board: "keep",
	hand_seat: "keep",
	hand_tag: "keep",
	hand_tag_link: "keep",
	ledger_category: "keep",
	ledger_line: "keep",
	oauth_access_token: "drop",
	oauth_client: "drop",
	oauth_client_assertion: "drop",
	oauth_client_resource: "drop",
	oauth_consent: "drop",
	oauth_refresh_token: "drop",
	oauth_resource: "drop",
	passkey: "drop",
	play_event: "keep",
	play_session: "keep",
	player: "keep",
	player_tag: "keep",
	player_tag_link: "keep",
	ring_game: "keep",
	room: "keep",
	session: "drop",
	tournament: "keep",
	tournament_rule: "keep",
	tournament_rule_level: "keep",
	tournament_rule_level_stake: "keep",
	tournament_rule_price: "keep",
	tournament_tag: "keep",
	tournament_tag_link: "keep",
	update_note_view: "keep",
	user: {
		columns: {
			created_at: "keep",
			email: { sql: `'user-' || "id" || '@scrubbed.invalid'` },
			email_verified: "keep",
			id: "keep",
			image: NULL_VALUE,
			name: "keep",
			updated_at: "keep",
		},
	},
	user_setting: "keep",
	verification: "drop",
	write_guard: "keep",
};

const WRANGLER_LEDGER = "d1_migrations";
const WRANGLER_LEDGER_DDL = `CREATE TABLE IF NOT EXISTS ${WRANGLER_LEDGER} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`;
const DEFER_FOREIGN_KEYS = "PRAGMA defer_foreign_keys=TRUE;";
const MIGRATION_FILE = /^\d{4}_.+\.sql$/u;
const REAL_LITERAL = /[.eE]/u;
const DEFAULT_MIGRATIONS = path.resolve(
	import.meta.dirname,
	"../packages/db/src/migrations"
);

export class ScrubPolicyError extends Error {}

function quoteIdentifier(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

function textRows(db: DatabaseSync, sql: string): string[] {
	const statement = db.prepare(sql);
	statement.setReturnArrays(true);
	return (statement.all() as unknown as SQLOutputValue[][]).map((row) =>
		String(row[0])
	);
}

function tableNames(db: DatabaseSync): string[] {
	return textRows(
		db,
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
	).filter((name) => name !== WRANGLER_LEDGER);
}

function columnNames(db: DatabaseSync, table: string): string[] {
	return textRows(
		db,
		`SELECT name FROM pragma_table_info('${table.replaceAll("'", "''")}') ORDER BY cid`
	);
}

export function openMigratedDatabase(
	migrationsDir = DEFAULT_MIGRATIONS
): DatabaseSync {
	const db = new DatabaseSync(":memory:", {
		enableForeignKeyConstraints: false,
	});
	const files = readdirSync(migrationsDir)
		.filter((name) => MIGRATION_FILE.test(name))
		.toSorted();
	for (const file of files) {
		for (const statement of readFileSync(
			path.join(migrationsDir, file),
			"utf8"
		).split("--> statement-breakpoint")) {
			const trimmed = statement.trim();
			if (trimmed && !trimmed.startsWith("PRAGMA foreign_keys=")) {
				db.exec(trimmed);
			}
		}
	}
	return db;
}

export function unclassified(db: DatabaseSync): string[] {
	const gaps: string[] = [];
	for (const table of tableNames(db)) {
		const rule = SCRUB_POLICY[table];
		if (rule === undefined) {
			gaps.push(table);
		} else if (typeof rule === "object") {
			for (const column of columnNames(db, table)) {
				if (!(column in rule.columns)) {
					gaps.push(`${table}.${column}`);
				}
			}
		}
	}
	return gaps;
}

function sqlLiteral(value: SQLOutputValue): string {
	if (value === null) {
		return "NULL";
	}
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			return value > 0 ? "9e999" : "-9e999";
		}
		const text = String(value);
		return REAL_LITERAL.test(text) ? text : `${text}.0`;
	}
	if (typeof value === "string") {
		return value.includes("\u0000")
			? `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`
			: `'${value.replaceAll("'", "''")}'`;
	}
	return `X'${Buffer.from(value).toString("hex")}'`;
}

function applyPolicy(db: DatabaseSync, table: string, rule: TableRule): void {
	if (rule === "drop") {
		db.exec(`DELETE FROM ${quoteIdentifier(table)}`);
		return;
	}
	if (rule === "keep") {
		return;
	}
	const assignments = columnNames(db, table).flatMap((column) => {
		const columnRule = rule.columns[column];
		return columnRule === undefined || columnRule === "keep"
			? []
			: [`${quoteIdentifier(column)} = ${columnRule.sql}`];
	});
	if (assignments.length > 0) {
		db.exec(`UPDATE ${quoteIdentifier(table)} SET ${assignments.join(", ")}`);
	}
}

function insertStatements(db: DatabaseSync, table: string): string[] {
	const columns = columnNames(db, table);
	const columnList = columns.map(quoteIdentifier).join(",");
	const statement = db.prepare(
		`SELECT ${columnList} FROM ${quoteIdentifier(table)}`
	);
	statement.setReadBigInts(true);
	statement.setReturnArrays(true);
	return (statement.all() as unknown as SQLOutputValue[][]).map(
		(row) =>
			`INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES(${row.map(sqlLiteral).join(",")});`
	);
}

export interface ScrubbedSeed {
	rows: number;
	sql: string;
}

export function scrubSeed(
	exportSql: string,
	migrationsDir = DEFAULT_MIGRATIONS
): ScrubbedSeed {
	const db = openMigratedDatabase(migrationsDir);
	try {
		const gaps = unclassified(db);
		if (gaps.length > 0) {
			throw new ScrubPolicyError(
				`No scrub decision in SCRUB_POLICY (scripts/scrub-seed.ts) for: ${gaps.join(", ")}`
			);
		}
		for (const trigger of textRows(
			db,
			"SELECT name FROM sqlite_master WHERE type = 'trigger'"
		)) {
			db.exec(`DROP TRIGGER ${quoteIdentifier(trigger)}`);
		}
		db.exec(WRANGLER_LEDGER_DDL);
		db.exec(exportSql);
		const statements: string[] = [];
		for (const table of tableNames(db)) {
			const rule = SCRUB_POLICY[table];
			if (rule === undefined) {
				throw new ScrubPolicyError(`No scrub decision for ${table}`);
			}
			applyPolicy(db, table, rule);
			statements.push(...insertStatements(db, table));
		}
		return {
			rows: statements.length,
			sql: [DEFER_FOREIGN_KEYS, ...statements]
				.map((statement) => `${statement}\n`)
				.join(""),
		};
	} finally {
		db.close();
	}
}

function main(): void {
	const { values } = parseArgs({
		options: {
			help: { type: "boolean" },
			input: { type: "string" },
			migrations: { type: "string" },
			output: { type: "string" },
		},
	});
	if (values.help || !values.input || !values.output) {
		console.error(USAGE);
		process.exit(values.help ? 0 : 2);
	}
	try {
		const seed = scrubSeed(
			readFileSync(values.input, "utf8"),
			values.migrations
		);
		writeFileSync(values.output, seed.sql);
		console.log(`scrub-seed: wrote ${seed.rows} row(s) to ${values.output}`);
	} catch (error) {
		console.error(
			`scrub-seed: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}
