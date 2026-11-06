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
const MIGRATION_FILE = /^\d{4}_.+\.sql$/u;
const CUTOVER_MIGRATION = "0061_entry_p1_cutover.sql";

const T0 = 1_757_066_400;
const LEGACY_FIXTURE = [
	`INSERT INTO user (id, name, email, created_at, updated_at) VALUES ('alice', 'Alice', 'alice@example.test', ${T0}, ${T0}), ('bob', 'Bob', 'bob@example.test', ${T0}, ${T0})`,
	`INSERT INTO asset (id, user_id, name, kind, decimals, created_at, updated_at) VALUES ('jpy', 'alice', 'JPY', 'currency', 0, ${T0}, ${T0}), ('bob-jpy', 'bob', 'JPY', 'currency', 0, ${T0}, ${T0})`,
	`INSERT INTO room (id, user_id, name, updated_at) VALUES ('club', 'alice', 'Club', ${T0})`,
	`INSERT INTO ring_game (id, user_id, room_id, name, updated_at) VALUES ('ring-1', 'alice', 'club', 'First', ${T0}), ('ring-2', 'alice', 'club', 'Second', ${T0})`,
	`INSERT INTO tournament (id, user_id, room_id, currency_id, name, buy_in, entry_fee, updated_at) VALUES ('daily', 'alice', 'club', 'jpy', 'Daily', 10000, 1000, ${T0})`,
	`INSERT INTO blind_level (id, tournament_id, level, blind1, blind2, minutes) VALUES ('daily-level', 'daily', 1, 100, 200, 20)`,
	`INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips) VALUES ('daily-addon', 'daily', 'Add-on', 3000, 10000)`,
	`INSERT INTO tournament_tag (id, tournament_id, name, created_at) VALUES ('tt-old', 'daily', 'Main Event', ${T0}), ('tt-dup', 'daily', ' main event ', ${T0 + 1})`,
	`INSERT INTO player (id, user_id, name, created_at, updated_at) VALUES ('tagged-player', 'alice', 'Tagged', ${T0}, ${T0})`,
	`INSERT INTO player_tag (id, user_id, name, color, created_at, updated_at) VALUES ('player-first', 'alice', 'Focus', 'red', ${T0}, ${T0}), ('player-dup', 'alice', ' focus ', 'blue', ${T0 + 1}, ${T0 + 1})`,
	"INSERT INTO player_to_player_tag (player_id, player_tag_id, position) VALUES ('tagged-player', 'player-dup', 3)",
	`INSERT INTO game_session (id, user_id, kind, status, source, session_date, started_at, ended_at, break_minutes, currency_id, hand_count, dealer_seat, created_at, updated_at) VALUES
	 ('live', 'alice', 'cash_game', 'completed', 'live', ${T0}, ${T0 + 17}, ${T0 + 7223}, 168, 'jpy', 2, 4, ${T0}, ${T0}),
	 ('mtt', 'alice', 'tournament', 'completed', 'live', ${T0}, ${T0 + 10_000}, ${T0 + 20_000}, 0, 'jpy', NULL, NULL, ${T0}, ${T0}),
	 ('manual', 'alice', 'cash_game', 'completed', 'manual', 1756944000, NULL, NULL, 0, 'jpy', NULL, NULL, ${T0}, ${T0}),
	 ('open-cash', 'bob', 'cash_game', 'active', 'live', ${T0}, ${T0 + 30_000}, NULL, 0, 'bob-jpy', NULL, NULL, ${T0}, ${T0})`,
	`INSERT INTO session_tag (id, user_id, name, created_at) VALUES ('tag-first', 'alice', 'Focus', ${T0}), ('tag-duplicate', 'alice', ' focus ', ${T0 + 1}), ('tag-other', 'alice', 'Other', ${T0}), ('bob-tag', 'bob', 'Focus', ${T0})`,
	"INSERT INTO session_to_session_tag (session_id, session_tag_id) VALUES ('manual', 'tag-first'), ('manual', 'tag-duplicate'), ('manual', 'bob-tag')",
	`INSERT INTO session_cash_detail (session_id, buy_in, cash_out, chip_remove_total, ev_cash_out) VALUES ('live', 35000, 45000, 2000, 45000), ('manual', 10000, 12000, NULL, NULL), ('open-cash', 10000, NULL, NULL, NULL)`,
	`INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee, placement, total_entries, before_deadline, prize_money, bounty_prizes) VALUES ('mtt', 'daily', 10000, 1000, 3, 50, 0, 30000, 2000)`,
	`INSERT INTO session_chip_purchase (id, session_id, name, cost, chips, sort_order) VALUES ('rebuy', 'mtt', 'Rebuy', 3000, 10000, 0)`,
	`INSERT INTO session_chip_purchase_result (session_chip_purchase_id, count) VALUES ('rebuy', 1)`,
	`INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
	 ('start', 'live', 'session_start', ${T0}, 1, '{"buyInAmount":30000}', ${T0}, ${T0}),
	 ('hero', 'live', 'player_join', ${T0 + 60}, 2, '{"isHero":true,"seatPosition":3}', ${T0}, ${T0}),
	 ('ghost', 'live', 'player_join', ${T0 + 120}, 4, '{"playerId":"ghost","isHero":false,"seatPosition":5}', ${T0}, ${T0}),
	 ('add-on', 'live', 'purchase_chips', ${T0 + 180}, 5, '{"name":"AddOn","cost":2000,"chips":200000}', ${T0}, ${T0}),
	 ('chips-in', 'live', 'chips_add_remove', ${T0 + 240}, 9, '{"amount":5000}', ${T0}, ${T0}),
	 ('pause-1', 'live', 'session_pause', ${T0 + 600}, 6, '{}', ${T0}, ${T0}),
	 ('pause-2', 'live', 'session_pause', ${T0 + 1200}, 7, '{}', ${T0}, ${T0}),
	 ('resume', 'live', 'session_resume', ${T0 + 1500}, 8, '{}', ${T0}, ${T0}),
	 ('chips-out', 'live', 'chips_add_remove', ${T0 + 3000}, 10, '{"amount":-2000}', ${T0}, ${T0}),
	 ('end', 'live', 'session_end', ${T0 + 7200}, 3, '{"cashOutAmount":45000}', ${T0}, ${T0}),
	 ('mtt-start', 'mtt', 'session_start', ${T0 + 10_000}, 1, '{"timerStartedAt":null}', ${T0}, ${T0}),
	 ('mtt-rebuy', 'mtt', 'purchase_chips', ${T0 + 12_000}, 2, '{"sessionChipPurchaseId":"rebuy","name":"Rebuy","cost":3000,"chips":10000}', ${T0}, ${T0}),
	 ('mtt-end', 'mtt', 'session_end', ${T0 + 20_000}, 3, '{"beforeDeadline":false,"placement":3,"totalEntries":50,"prizeMoney":30000,"bountyPrizes":2000}', ${T0}, ${T0}),
	 ('open-start', 'open-cash', 'session_start', ${T0 + 30_000}, 1, '{"buyInAmount":10000}', ${T0}, ${T0}),
	 ('open-all-in', 'open-cash', 'all_in', ${T0 + 30_060}, 2, '{"potSize":101,"trials":1,"equity":50,"wins":0}', ${T0}, ${T0})`,
];
const FIXTURE = [
	`UPDATE hand SET played_at = ${T0 + 1800}, detail = 'full' WHERE id = 'h:live:1'`,
	`INSERT INTO hand_seat (hand_id, user_id, seat, is_hero) VALUES ('h:live:1', 'alice', 3, 1)`,
];

const databaseId = /database_id = "(?<id>[^"]+)"/u.exec(
	readFileSync(WRANGLER_TOML, "utf8")
)?.groups?.id;

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
		d1Databases: { DB: databaseId },
		d1Persist: path.join(dir, "v3/d1"),
		modules: true,
		script: "export default { fetch() { return new Response('') } }",
	});
	try {
		await use(await miniflare.getD1Database("DB"));
	} finally {
		await miniflare.dispose();
	}
}

async function createDatabase(
	name: string,
	{
		through,
		legacy = [],
		statements,
	}: { through?: string; legacy?: string[]; statements: string[] }
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
			if (file === CUTOVER_MIGRATION) {
				for (const statement of legacy) {
					// biome-ignore lint/performance/noAwaitInLoops: Migration fixtures must execute in order.
					await d1.prepare(statement).run();
				}
			}
			await d1.prepare(readFileSync(path.join(MIGRATIONS, file), "utf8")).run();
			await d1
				.prepare("INSERT INTO d1_migrations (name) VALUES (?)")
				.bind(file)
				.run();
		}
		for (const statement of statements) {
			// biome-ignore lint/performance/noAwaitInLoops: Fixture statements must execute in order.
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
			// biome-ignore lint/performance/noAwaitInLoops: Fixture statements must execute in order.
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
	return { report, status: run.status, stderr: run.stderr };
}

function statuses(report: AuditReport | null, auditId: string): CheckStatus[] {
	return (report?.results ?? [])
		.filter((result) => result.audit === auditId)
		.map((result) => result.status);
}

function rows(report: AuditReport | null, auditId: string) {
	return (report?.results ?? [])
		.filter((result) => result.audit === auditId)
		.flatMap((result) => result.rows);
}

beforeAll(async () => {
	seeded = await createDatabase("seeded", {
		legacy: LEGACY_FIXTURE,
		statements: FIXTURE,
	});
}, RUN_TIMEOUT);

afterAll(() => {
	rmSync(scratch, { force: true, recursive: true });
});

describe("audit-data-model through wrangler's local D1", () => {
	it(
		"passes every remaining audit on clean migrated data",
		() => {
			const gate = audit(seeded);
			expect(gate.status).toBe(0);
			expect(gate.report?.results.length).toBeGreaterThan(0);
			expect(
				gate.report?.results.filter((result) => result.status !== "pass")
			).toEqual([]);
			expect(statuses(gate.report, "A-6")).toEqual(["pass", "pass", "pass"]);
			expect(statuses(gate.report, "A-13")).toEqual(["pass", "pass"]);
		},
		RUN_TIMEOUT
	);

	it(
		"fails the gate for another master's current rule and a missing cash stake",
		async () => {
			const dir = await copyWith("broken-ring-rules", [
				"UPDATE ring_game SET current_rule_id = 'cr:ring-2' WHERE id = 'ring-1'",
				"DELETE FROM cash_rule_stake WHERE rule_id = 'cr:ring-2'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-13")).toContainEqual({ id: "ring-1" });
			expect(rows(result.report, "A-14")).toContainEqual(
				expect.objectContaining({ rule_id: "cr:ring-2" })
			);
		},
		RUN_TIMEOUT
	);

	it(
		"fails the gate when an activated check's required table is missing",
		async () => {
			const dir = await copyWith("missing-audit-table", [
				"DROP TABLE user_setting",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(result.report?.results).toContainEqual(
				expect.objectContaining({
					audit: "A-14",
					part: "base setting asset is a currency",
					status: "error",
				})
			);
		},
		RUN_TIMEOUT
	);

	it(
		"fails the gate when an activated check's SQL cannot execute",
		async () => {
			const dir = await copyWith("broken-audit-sql", [
				"ALTER TABLE user_setting RENAME COLUMN base_asset_id TO renamed_base_asset_id",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(result.report?.results).toContainEqual(
				expect.objectContaining({
					audit: "A-14",
					part: "base setting asset is a currency",
					status: "error",
				})
			);
		},
		RUN_TIMEOUT
	);

	it(
		"replays the tournament entry cost from the event payment",
		async () => {
			const dir = await copyWith("tournament-rule-price", [
				"UPDATE play_event SET payload = json_set(payload, '$.payments[0].quantity', 9000) WHERE id = 'mtt-start'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-6")).toContainEqual(
				expect.objectContaining({
					field: "quantity",
					projected: -9000,
					stored: -10_000,
					target: "ledger_line mtt-start:0",
				})
			);
		},
		RUN_TIMEOUT
	);

	it(
		"fails A-6 when projected amounts are broken",
		async () => {
			const dir = await copyWith("broken-projection", [
				"UPDATE ledger_line SET quantity = -25000 WHERE id = 'start:0'",
				"UPDATE entry_cash SET ev_diff = 50 WHERE entry_id = 'open-cash'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-6")).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						field: "quantity",
						projected: -30_000,
						stored: -25_000,
						target: "ledger_line start:0",
					}),
					expect.objectContaining({
						field: "ev_diff",
						projected: 51,
						stored: 50,
						target: "entry_cash",
					}),
				])
			);
		},
		RUN_TIMEOUT
	);

	it(
		"accepts a corrected hand seat independent of live occupancy",
		async () => {
			const dir = await copyWith("corrected-hero-seat", [
				"UPDATE hand_seat SET seat = 5 WHERE hand_id = 'h:live:1'",
			]);
			const result = audit(dir);
			expect(statuses(result.report, "A-6")).toEqual(["pass", "pass", "pass"]);
			expect(result.status).toBe(0);
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
			const result = audit(dir);
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
		"detects inconsistent self players and non-v2 events",
		async () => {
			const dir = await copyWith("broken-self-and-version", [
				"UPDATE player SET is_temporary = 1 WHERE id = 'self:alice'",
				`INSERT INTO player (id, user_id, name, updated_at) VALUES ('opponent', 'alice', 'Opponent', ${T0})`,
				"UPDATE hand_seat SET player_id = 'opponent' WHERE hand_id = 'h:live:1'",
				"UPDATE play_event SET schema_version = 1 WHERE id = 'hero'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-14")).toEqual(
				expect.arrayContaining([
					{ id: "self:alice", problem: "temporary self" },
					{ id: "h:live:1", problem: "hero player" },
				])
			);
			expect(rows(result.report, "A-15")).toContainEqual(
				expect.objectContaining({
					event_id: "hero",
					problem: "schema_version 1 is not 2",
				})
			);
		},
		RUN_TIMEOUT
	);

	it(
		"detects a foreign asset in a chips adjustment event",
		async () => {
			const dir = await copyWith("foreign-event-asset", [
				"UPDATE play_event SET payload = json_set(payload, '$.assetId', 'bob-jpy') WHERE id = 'chips-in'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-15")).toContainEqual({
				id: "chips-in",
				ref_id: "bob-jpy",
				reference: "asset",
			});
		},
		RUN_TIMEOUT
	);

	it(
		"reports v2 audits as not introduced on a database before the v2 schema migration",
		async () => {
			const dir = await createDatabase("before-v2", {
				statements: [],
				through: "0058_wonderful_wolfpack.sql",
			});
			const result = audit(dir);
			expect(result.status).toBe(0);
			expect(statuses(result.report, "FK")).toEqual(["pass"]);
			expect(new Set(statuses(result.report, "A-14"))).toEqual(
				new Set(["not-introduced"])
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
