import { spawnSync } from "node:child_process";
import path from "node:path";
import z from "zod";

export type Row = Record<string, unknown>;

export interface AuditTarget {
	config: string;
	database: string;
	mode: "local" | "remote";
	persistTo?: string;
}

export interface AuditDatabase {
	readonly label: string;
	query(statements: readonly string[]): Row[][];
}

export class AuditDatabaseError extends Error {}

const READ_ONLY_STATEMENT = /^\s*(SELECT|WITH|PRAGMA\s+foreign_key_check)\b/i;
const MAX_BUFFER = 1024 * 1024 * 1024;
const STATEMENT_BATCH = 12;
const WRANGLER = path.resolve(
	import.meta.dirname,
	"../../node_modules/wrangler/bin/wrangler.js"
);

const wranglerResults = z.array(
	z.object({
		success: z.literal(true),
		results: z.array(z.record(z.string(), z.unknown())),
	})
);

function assertReadOnly(statement: string): void {
	if (!READ_ONLY_STATEMENT.test(statement)) {
		throw new AuditDatabaseError(
			`Refusing a statement that is not a read-only query: ${statement.slice(0, 120)}`
		);
	}
}

function parseResults(stdout: string, expected: number): Row[][] {
	let json: unknown;
	try {
		json = JSON.parse(stdout);
	} catch {
		throw new AuditDatabaseError(
			`wrangler returned output that is not JSON: ${stdout.slice(0, 500)}`
		);
	}
	const parsed = wranglerResults.safeParse(json);
	if (!parsed.success || parsed.data.length !== expected) {
		throw new AuditDatabaseError(
			`wrangler did not return ${expected} successful result sets: ${stdout.slice(0, 500)}`
		);
	}
	return parsed.data.map((result) => result.results);
}

export function wranglerDatabase(target: AuditTarget): AuditDatabase {
	const baseArgs = [
		WRANGLER,
		"d1",
		"execute",
		target.database,
		target.mode === "remote" ? "--remote" : "--local",
		"--config",
		target.config,
		"--json",
		...(target.persistTo ? ["--persist-to", target.persistTo] : []),
	];

	function run(statements: readonly string[]): Row[][] {
		const result = spawnSync(
			"node",
			[...baseArgs, "--command", statements.join(";\n")],
			{ encoding: "utf8", maxBuffer: MAX_BUFFER }
		);
		if (result.error) {
			throw new AuditDatabaseError(
				`could not start wrangler: ${result.error.message}`
			);
		}
		if (result.status !== 0) {
			const detail = (result.stdout || result.stderr || "").trim();
			throw new AuditDatabaseError(
				`wrangler exited with ${result.status}: ${detail.slice(0, 1000)}`
			);
		}
		return parseResults(result.stdout, statements.length);
	}

	return {
		label: `${target.database} (${target.mode}${target.persistTo ? `, ${target.persistTo}` : ""})`,
		query(statements) {
			for (const statement of statements) {
				assertReadOnly(statement);
			}
			const results: Row[][] = [];
			for (let i = 0; i < statements.length; i += STATEMENT_BATCH) {
				results.push(...run(statements.slice(i, i + STATEMENT_BATCH)));
			}
			return results;
		},
	};
}

export function sqlString(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function field(row: Row, key: string): unknown {
	if (!Object.hasOwn(row, key)) {
		throw new AuditDatabaseError(`result row has no column ${key}`);
	}
	return row[key];
}

export function text(row: Row, key: string): string {
	const value = field(row, key);
	if (typeof value !== "string") {
		throw new AuditDatabaseError(`column ${key} is not text: ${value}`);
	}
	return value;
}

export function nullableText(row: Row, key: string): string | null {
	const value = field(row, key);
	return value === null ? null : text(row, key);
}

export function integer(row: Row, key: string): number {
	const value = field(row, key);
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new AuditDatabaseError(`column ${key} is not an integer: ${value}`);
	}
	return value;
}

export function nullableInteger(row: Row, key: string): number | null {
	const value = field(row, key);
	return value === null ? null : integer(row, key);
}
