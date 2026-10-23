import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuditReport, CheckStatus } from "../data-model-audit/run";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS = path.join(ROOT, "packages/db/src/migrations");
const WRANGLER_TOML = path.join(ROOT, "apps/server/wrangler.toml");
const DATABASE = "sapphire2-db";
const RUN_TIMEOUT = 180_000;
const MIGRATION_FILE = /^\d{4}_.+\.sql$/;

const T0 = 1_757_066_400;
const FIXTURE = [
	`INSERT INTO user (id, name, email, created_at, updated_at) VALUES ('alice', 'Alice', 'alice@example.test', ${T0}, ${T0})`,
	`INSERT INTO asset (id, user_id, name, kind, decimals, created_at, updated_at) VALUES ('jpy', 'alice', 'JPY', 'currency', 0, ${T0}, ${T0})`,
	`INSERT INTO entry (id, user_id, kind, source, status, asset_id, played_on, created_at, updated_at) VALUES
	 ('live', 'alice', 'cash', 'live', 'settled', 'jpy', '2025-09-05', ${T0}, ${T0}),
	 ('manual', 'alice', 'cash', 'manual', 'settled', 'jpy', '2025-09-04', ${T0}, ${T0})`,
	`INSERT INTO entry_cash (entry_id, user_id, kind, ev_diff) VALUES ('live', 'alice', 'cash', 0), ('manual', 'alice', 'cash', NULL)`,
	`INSERT INTO play_session (id, user_id, entry_id, kind, seq, local_date, started_at, ended_at, break_minutes, status, end_state, end_stack, created_at, updated_at) VALUES
	 ('live-day', 'alice', 'live', 'cash', 1, '2025-09-05', ${T0}, ${T0 + 7200}, 0, 'ended', 'cashed_out', 45000, ${T0}, ${T0}),
	 ('manual-day', 'alice', 'manual', 'cash', 1, '2025-09-04', NULL, NULL, 0, 'ended', 'cashed_out', NULL, ${T0}, ${T0})`,
	`INSERT INTO play_event (id, user_id, entry_id, entry_source, play_session_id, type, schema_version, occurred_at, sort_order, payload, created_at, updated_at) VALUES
	 ('start', 'alice', 'live', 'live', 'live-day', 'session_start', 1, ${T0}, 1, '{"buyInAmount":30000}', ${T0}, ${T0}),
	 ('hero', 'alice', 'live', 'live', 'live-day', 'player_join', 1, ${T0 + 60}, 2, '{"isHero":true,"seatPosition":3}', ${T0}, ${T0}),
	 ('end', 'alice', 'live', 'live', 'live-day', 'session_end', 1, ${T0 + 7200}, 3, '{"cashOutAmount":45000}', ${T0}, ${T0})`,
	`INSERT INTO ledger_line (id, user_id, asset_id, quantity, role, effect, entry_id, play_session_id, source_event_id, occurred_at, created_at, updated_at) VALUES
	 ('start:0', 'alice', 'jpy', -30000, 'buy_in', 'real', 'live', 'live-day', 'start', ${T0}, ${T0}, ${T0}),
	 ('end:0', 'alice', 'jpy', 45000, 'cash_out', 'real', 'live', 'live-day', 'end', ${T0 + 7200}, ${T0}, ${T0})`,
	`INSERT INTO hand (id, user_id, play_session_id, hand_no, played_at, detail, created_at, updated_at) VALUES ('hand-1', 'alice', 'live-day', 1, ${T0 + 1800}, 'full', ${T0}, ${T0})`,
	`INSERT INTO hand_seat (hand_id, user_id, seat, is_hero) VALUES ('hand-1', 'alice', 3, 1)`,
];

const databaseId = /database_id = "([^"]+)"/.exec(
	readFileSync(WRANGLER_TOML, "utf8")
)?.[1];

const scratch = mkdtempSync(path.join(tmpdir(), "audit-data-model-"));
let seeded = "";

async function withD1(
	dir: string,
	use: (d1: Awaited<ReturnType<Miniflare["getD1Database"]>>) => Promise<void>
) {
	if (!databaseId) {
		throw new Error("wrangler.toml has no database_id");
	}
	const miniflare = new Miniflare({
		modules: true,
		script: "export default { fetch() { return new Response('') } }",
		d1Databases: { DB: databaseId },
		d1Persist: path.join(dir, "v3/d1"),
	});
	try {
		await use(await miniflare.getD1Database("DB"));
	} finally {
		await miniflare.dispose();
	}
}

async function createDatabase(
	name: string,
	{ through, statements }: { through?: string; statements: string[] }
): Promise<string> {
	const dir = path.join(scratch, name);
	await withD1(dir, async (d1) => {
		await d1
			.prepare(
				"CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)"
			)
			.run();
		const files = readdirSync(MIGRATIONS)
			.filter((file) => MIGRATION_FILE.test(file))
			.sort()
			.filter((file) => through === undefined || file <= through);
		for (const file of files) {
			await d1.prepare(readFileSync(path.join(MIGRATIONS, file), "utf8")).run();
			await d1
				.prepare("INSERT INTO d1_migrations (name) VALUES (?)")
				.bind(file)
				.run();
		}
		for (const statement of statements) {
			await d1.prepare(statement).run();
		}
	});
	return dir;
}

async function copyWith(name: string, statements: string[]): Promise<string> {
	const dir = path.join(scratch, name);
	cpSync(seeded, dir, { recursive: true });
	await withD1(dir, async (d1) => {
		for (const statement of statements) {
			await d1.prepare(statement).run();
		}
	});
	return dir;
}

function audit(dir: string, ...args: string[]) {
	const run = spawnSync(
		"bun",
		[
			"scripts/audit-data-model.ts",
			"--local",
			"--database",
			DATABASE,
			"--persist-to",
			dir,
			"--json",
			...args,
		],
		{ cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
	);
	const report =
		run.status === 0 || run.status === 1
			? (JSON.parse(run.stdout) as AuditReport)
			: null;
	return { status: run.status, report, stderr: run.stderr };
}

function statuses(report: AuditReport | null, audit: string): CheckStatus[] {
	return (report?.results ?? [])
		.filter((result) => result.audit === audit)
		.map((result) => result.status);
}

function rows(report: AuditReport | null, audit: string) {
	return (report?.results ?? [])
		.filter((result) => result.audit === audit)
		.flatMap((result) => result.rows);
}

const ENTRY_AUDITS = "A-6,A-8,A-9";

beforeAll(async () => {
	seeded = await createDatabase("seeded", { statements: FIXTURE });
}, RUN_TIMEOUT);

afterAll(() => {
	rmSync(scratch, { recursive: true, force: true });
});

describe("audit-data-model through wrangler's local D1", () => {
	it(
		"passes a consistent live and manual entry and keeps pending audits out of the gate",
		() => {
			const enabled = audit(seeded, "--enable", ENTRY_AUDITS);
			expect(enabled.status).toBe(0);
			expect(statuses(enabled.report, "A-6")).toEqual(["pass", "pass", "pass"]);
			expect(statuses(enabled.report, "A-8")).toEqual(["pass"]);
			expect(statuses(enabled.report, "A-9")).toEqual(["pass"]);

			const gate = audit(seeded);
			expect(gate.status).toBe(0);
			expect(statuses(gate.report, "A-6")).toEqual([
				"pending",
				"pending",
				"pending",
			]);
			expect(statuses(gate.report, "A-14")).toContain("pass");
		},
		RUN_TIMEOUT
	);

	it(
		"fails A-6 when a projected amount or the Hero seat is broken",
		async () => {
			const dir = await copyWith("broken-projection", [
				"UPDATE ledger_line SET quantity = -25000 WHERE id = 'start:0'",
				"UPDATE hand_seat SET seat = 5 WHERE hand_id = 'hand-1'",
			]);
			const result = audit(dir, "--enable", ENTRY_AUDITS);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-6")).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						target: "ledger_line start:0",
						field: "quantity",
						stored: -25_000,
						projected: -30_000,
					}),
					expect.objectContaining({
						target: "hand hand-1",
						field: "hero seat",
						stored: 5,
						projected: 3,
					}),
				])
			);
		},
		RUN_TIMEOUT
	);

	it(
		"fails A-8 on a played_on shift and A-9 on a status that contradicts the days",
		async () => {
			const dir = await copyWith("broken-entry", [
				"UPDATE entry SET played_on = '2025-09-03' WHERE id = 'manual'",
				"UPDATE entry SET status = 'open' WHERE id = 'live'",
			]);
			const result = audit(dir, "--enable", ENTRY_AUDITS);
			expect(result.status).toBe(1);
			expect(statuses(result.report, "A-8")).toEqual(["violation"]);
			expect(rows(result.report, "A-8")).toEqual([
				expect.objectContaining({ id: "manual" }),
			]);
			expect(statuses(result.report, "A-9")).toEqual(["violation"]);
			expect(rows(result.report, "A-9")).toEqual([
				expect.objectContaining({ id: "live" }),
			]);
		},
		RUN_TIMEOUT
	);

	it(
		"reports an A-11 balance drift without failing",
		async () => {
			const dir = await copyWith("balance-drift", [
				`INSERT INTO transaction_type (id, user_id, name, created_at, updated_at) VALUES ('deposit', 'alice', 'Deposit', ${T0}, ${T0})`,
				`INSERT INTO currency_transaction (id, currency_id, transaction_type_id, amount, transacted_at, created_at) VALUES ('legacy', 'jpy', 'deposit', 15500, ${T0}, ${T0})`,
			]);
			const result = audit(dir, "--enable", `${ENTRY_AUDITS},A-11`);
			expect(result.status).toBe(0);
			expect(statuses(result.report, "A-11")).toEqual(["report"]);
			expect(rows(result.report, "A-11")).toEqual([
				{ user_id: "alice", asset_id: "jpy", legacy: 15_500, ledger: 15_000 },
			]);
		},
		RUN_TIMEOUT
	);

	it(
		"reports v2 audits as not introduced on a database before the v2 schema migration",
		async () => {
			const dir = await createDatabase("before-v2", {
				through: "0058_wonderful_wolfpack.sql",
				statements: [],
			});
			const result = audit(dir);
			expect(result.status).toBe(0);
			expect(statuses(result.report, "FK")).toEqual(["pass"]);
			expect(new Set(statuses(result.report, "A-14"))).toEqual(
				new Set(["not-introduced", "pending"])
			);
			expect(new Set(statuses(result.report, "A-15"))).toEqual(
				new Set(["not-introduced"])
			);
		},
		RUN_TIMEOUT
	);

	it(
		"never reports success when the database cannot be read",
		() => {
			const result = audit(seeded, "--database", "missing-db");
			expect(result.status).toBe(2);
			expect(result.report).toBeNull();
		},
		RUN_TIMEOUT
	);
});
