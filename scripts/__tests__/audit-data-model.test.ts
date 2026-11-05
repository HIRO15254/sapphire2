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

beforeAll(async () => {
	seeded = await createDatabase("seeded", {
		legacy: LEGACY_FIXTURE,
		statements: FIXTURE,
	});
}, RUN_TIMEOUT);

afterAll(() => {
	rmSync(scratch, { recursive: true, force: true });
});

describe("audit-data-model through wrangler's local D1", () => {
	it(
		"passes sessions migrated by the cutover and keeps pending audits out of the gate",
		() => {
			const enabled = audit(seeded, "--enable", "A-6");
			expect(enabled.status).toBe(0);
			expect(statuses(enabled.report, "A-6")).toEqual(["pass", "pass", "pass"]);

			const gate = audit(seeded);
			expect(gate.status).toBe(0);
			for (const id of ["A-3", "A-4", "A-5", "A-8", "A-9", "A-10"]) {
				expect(statuses(gate.report, id), id).toEqual(["pass"]);
			}
			expect(statuses(gate.report, "A-6")).toEqual(["pass", "pass", "pass"]);
			expect(statuses(gate.report, "A-12")).toEqual(["pass", "pass", "pass"]);
			expect(statuses(gate.report, "A-13")).toEqual([
				"pass",
				"pass",
				"pass",
				"pass",
			]);
			expect(statuses(gate.report, "A-14")).toContain("pass");
		},
		RUN_TIMEOUT
	);

	it(
		"detects missing and unexpected historical entry tag links",
		async () => {
			const dir = await copyWith("broken-entry-tags", [
				"DELETE FROM entry_tag_link WHERE entry_id = 'manual' AND tag_id = 'tag-first'",
				"INSERT INTO entry_tag_link (entry_id, user_id, tag_id) VALUES ('manual', 'alice', 'tag-other')",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-12")).toEqual(
				expect.arrayContaining([
					{
						problem: "missing",
						entry_id: "manual",
						user_id: "alice",
						tag_id: "tag-first",
					},
					{
						problem: "unexpected",
						entry_id: "manual",
						user_id: "alice",
						tag_id: "tag-other",
					},
				])
			);
		},
		RUN_TIMEOUT
	);

	it(
		"detects missing historical tournament and player tag links",
		async () => {
			const dir = await copyWith("broken-other-tags", [
				"DELETE FROM tournament_tag_link WHERE tournament_id = 'daily'",
				"DELETE FROM player_tag_link WHERE player_id = 'tagged-player'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(statuses(result.report, "A-12")).toEqual([
				"pass",
				"violation",
				"violation",
			]);
			expect(rows(result.report, "A-12")).toEqual(
				expect.arrayContaining([
					{
						problem: "missing",
						tournament_id: "daily",
						user_id: "alice",
						tag_id: "tt:alice:6D61696E206576656E74",
					},
					{
						problem: "missing",
						player_id: "tagged-player",
						user_id: "alice",
						tag_id: "player-first",
					},
				])
			);
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
		"detects changes to migrated tournament levels, flat stakes and addon prices",
		async () => {
			const dir = await copyWith("broken-tournament-content", [
				"UPDATE tournament_rule_level SET minutes = 30 WHERE id = 'trl:daily-level'",
				"UPDATE tournament_rule_level_stake SET blind1 = 150 WHERE level_id = 'trl:daily-level'",
				"UPDATE tournament_rule_price SET amount = 4000 WHERE id = 'trp:daily-addon'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-13")).toEqual(
				expect.arrayContaining([
					{ problem: "missing or changed level", id: "trl:daily-level" },
					{ problem: "flat stakes", id: "trl:daily-level" },
					{ problem: "missing or changed addon", id: "trp:daily-addon" },
				])
			);
		},
		RUN_TIMEOUT
	);

	it(
		"detects an entry version whose content no longer matches its snapshot",
		async () => {
			const dir = await copyWith("broken-entry-rule", [
				"UPDATE cash_rule SET table_size = 6 WHERE id = 'cr:e:manual'",
				"UPDATE cash_rule_stake SET blind1 = 7 WHERE rule_id = 'cr:e:live'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-13")).toEqual(
				expect.arrayContaining([
					{ problem: "cash scalars", id: "manual" },
					{ problem: "cash flat stakes", id: "live" },
				])
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
			const result = audit(dir, "--enable", "A-6");
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-6")).toContainEqual(
				expect.objectContaining({
					target: "ledger_line mtt-start:0",
					field: "quantity",
					stored: -10_000,
					projected: -9000,
				})
			);
		},
		RUN_TIMEOUT
	);

	it(
		"fails A-3 on a lost event and A-4 on a changed break",
		async () => {
			const dir = await copyWith("broken-cutover", [
				"DELETE FROM play_event WHERE id = 'hero'",
				"UPDATE play_session SET break_minutes = 7 WHERE id = 'live'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-3")).toEqual([
				{ source: "session_event", id: "hero" },
			]);
			expect(rows(result.report, "A-4")).toEqual([{ id: "live" }]);
		},
		RUN_TIMEOUT
	);

	it(
		"fails A-5 and A-6 when a projected amount or the Hero seat is broken",
		async () => {
			const dir = await copyWith("broken-projection", [
				"UPDATE ledger_line SET quantity = -25000 WHERE id = 'start:0'",
				"UPDATE hand_seat SET seat = 5 WHERE hand_id = 'h:live:1'",
				"UPDATE entry_cash SET ev_diff = 50 WHERE entry_id = 'open-cash'",
			]);
			const result = audit(dir, "--enable", "A-6");
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
						target: "hand h:live:1",
						field: "hero seat",
						stored: 5,
						projected: 3,
					}),
					expect.objectContaining({
						target: "entry_cash",
						field: "ev_diff",
						stored: 50,
						projected: 51,
					}),
				])
			);
			expect(rows(result.report, "A-5")).toEqual([
				{ id: "live", expected: 12_000, actual: 17_000 },
			]);
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
		"fails A-10 when the migrated last hand no longer carries the legacy dealer seat",
		async () => {
			const dir = await copyWith("broken-hands", [
				"UPDATE hand SET button_seat = 5 WHERE id = 'h:live:2'",
			]);
			const result = audit(dir);
			expect(result.status).toBe(1);
			expect(rows(result.report, "A-10")).toEqual([
				{ id: "live", hands: 2, hand_count: 2, dealer_seat: 4 },
			]);
		},
		RUN_TIMEOUT
	);

	it(
		"reports a per-asset A-11 balance drift without failing",
		async () => {
			const dir = await copyWith("balance-drift", [
				`INSERT INTO transaction_type (id, user_id, name, created_at, updated_at) VALUES ('result', 'alice', 'Session Result', ${T0}, ${T0})`,
				`INSERT INTO currency_transaction (id, currency_id, transaction_type_id, session_id, amount, transacted_at, created_at) VALUES
				 ('manual-result', 'jpy', 'result', 'manual', 2000, ${T0}, ${T0}),
				 ('live-result', 'jpy', 'result', 'live', 11000, ${T0}, ${T0}),
				 ('mtt-result', 'jpy', 'result', 'mtt', 18000, ${T0}, ${T0})`,
			]);
			const result = audit(dir);
			expect(result.status).toBe(0);
			expect(statuses(result.report, "A-11")).toEqual(["report"]);
			expect(rows(result.report, "A-11")).toEqual([
				{ user_id: "alice", asset_id: "jpy", legacy: 31_000, ledger: 32_000 },
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
