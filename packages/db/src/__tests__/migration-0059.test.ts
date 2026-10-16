import type { Database as SQLiteDatabase } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// biome-ignore lint/correctness/noUndeclaredVariables: Bun global is only present in Bun runtime
const isBun = typeof Bun !== "undefined";
const skipIfNotBun = isBun ? describe : describe.skip;
let Database: typeof SQLiteDatabase;
if (isBun) {
	Database = require("bun:sqlite").Database;
}

const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);
const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const NOT_NULL_VIOLATION = /NOT NULL constraint failed/;
function statementsOf(name: string): string[] {
	return readFileSync(join(migrationsDirectory, name), "utf8")
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(
			(statement) => statement && !statement.startsWith("PRAGMA foreign_keys=")
		);
}
const earlierMigrations = readdirSync(migrationsDirectory)
	.filter((name) => MIGRATION_FILE_PATTERN.test(name) && name < "0059_")
	.toSorted()
	.flatMap(statementsOf);
const targetStatements = statementsOf("0059_entry_p1_cutover.sql");
const midnight = Date.parse("2026-10-08T00:00:00Z") / 1000;
const late = midnight + 14 * 3600 + 59 * 60;
const nextDay = midnight + 15 * 3600;
const longTitle = "t".repeat(300);
const longMemo = "m".repeat(20_001);

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES
 ('alice-room', 'alice', 'Club', 2), ('bob-room', 'bob', 'Bar', 2);
INSERT INTO currency (id, user_id, name, updated_at) VALUES
 ('alice-currency', 'alice', 'Chips', 2), ('bob-currency', 'bob', 'Coins', 2);
INSERT INTO ring_game (id, user_id, room_id, currency_id, name, created_at, updated_at) VALUES
 ('alice-ring', 'alice', 'alice-room', 'alice-currency', 'Cash', 1, 2),
 ('bob-ring', 'bob', 'bob-room', 'bob-currency', 'Cash', 1, 2);
INSERT INTO tournament (id, user_id, room_id, currency_id, name, created_at, updated_at) VALUES
 ('alice-mtt', 'alice', 'alice-room', 'alice-currency', 'Daily', 1, 2),
 ('bob-mtt', 'bob', 'bob-room', 'bob-currency', 'Daily', 1, 2);
INSERT INTO game_session
 (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, room_id, currency_id, created_at, updated_at) VALUES
 ('manual-cash', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, 'alice-room', 'alice-currency', 1, 2),
 ('manual-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, 0, NULL, NULL, 1, 2),
 ('live-cash', 'alice', 'cash_game', 'live', 'completed', ${midnight}, ${late}, ${nextDay}, 5, 'alice-room', 'alice-currency', 1, 2),
 ('live-mtt', 'alice', 'tournament', 'live', 'completed', ${midnight}, ${nextDay}, ${nextDay + 60}, 0, NULL, NULL, 1, 2),
 ('active', 'alice', 'cash_game', 'live', 'active', ${midnight}, ${late}, NULL, NULL, NULL, NULL, 1, 2),
 ('paused', 'bob', 'tournament', 'live', 'paused', ${nextDay}, NULL, NULL, 3, NULL, NULL, 1, 2),
 ('bad-cash', 'alice', 'cash_game', 'live', 'completed', ${midnight}, ${nextDay}, ${late}, -5, 'bob-room', 'bob-currency', 1, 2),
 ('bad-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, 0, 'bob-room', 'bob-currency', 1, 2),
 ('missing-cash', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('missing-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('invalid-total', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('invalid-placement', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2);
INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in, cash_out, ev_cash_out, rule_name) VALUES
 ('manual-cash', NULL, 100, 150, NULL, '${longTitle}'),
 ('live-cash', 'alice-ring', 100, 100, 50.5, 'Cash'),
 ('active', NULL, 100, 100, 200, 'Active'),
 ('bad-cash', 'bob-ring', 100, -1, 0, 'Foreign cash');
INSERT INTO session_tournament_detail
 (session_id, tournament_id, placement, total_entries, before_deadline, timer_started_at, rule_name) VALUES
 ('manual-mtt', NULL, 1, 50, 1, NULL, 'Manual tournament'),
 ('live-mtt', 'alice-mtt', 1, 50, 1, ${nextDay + 10}, 'Daily'),
 ('paused', NULL, NULL, NULL, 0, ${nextDay + 20}, 'Paused'),
 ('bad-mtt', 'bob-mtt', 20, 10, 2, NULL, 'Foreign tournament'),
 ('invalid-total', NULL, 2, -1, 0, NULL, 'Invalid total'),
 ('invalid-placement', NULL, 0, 5, 0, NULL, 'Invalid placement');
UPDATE game_session SET memo = '${longMemo}' WHERE id = 'manual-cash';
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('broken', 'live-cash', 'session_end', ${nextDay}, 0, '{broken', 1, 2),
 ('unknown', 'live-mtt', 'legacy_custom_type', ${nextDay + 30}, 0, '{"kept":true}', 1, 2);
`;

function apply(db: SQLiteDatabase, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

skipIfNotBun("migration 0059 — entry P1 cutover", () => {
	let db: SQLiteDatabase;
	beforeEach(() => {
		db = new Database(":memory:");
		db.exec("PRAGMA foreign_keys=ON");
		apply(db, earlierMigrations);
		db.exec(SEED);
	});
	afterEach(() => db?.close());

	it("moves historical sessions and events without changing legacy facts or leaking foreign links", () => {
		const legacy = [
			"game_session",
			"session_cash_detail",
			"session_tournament_detail",
			"session_event",
		].map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all());
		apply(db);
		const expectedEntries = [
			[
				"active",
				"alice",
				"cash",
				"live",
				"open",
				null,
				null,
				"Active",
				"2026-10-08",
				null,
			],
			[
				"bad-cash",
				"alice",
				"cash",
				"live",
				"settled",
				null,
				null,
				null,
				"2026-10-09",
				null,
			],
			[
				"bad-mtt",
				"alice",
				"tournament",
				"manual",
				"settled",
				null,
				null,
				null,
				"2026-10-08",
				null,
			],
			[
				"invalid-placement",
				"alice",
				"tournament",
				"manual",
				"settled",
				null,
				null,
				"Invalid placement",
				"2026-10-08",
				null,
			],
			[
				"invalid-total",
				"alice",
				"tournament",
				"manual",
				"settled",
				null,
				null,
				"Invalid total",
				"2026-10-08",
				null,
			],
			[
				"live-cash",
				"alice",
				"cash",
				"live",
				"settled",
				"alice-room",
				"alice-currency",
				null,
				"2026-10-08",
				null,
			],
			[
				"live-mtt",
				"alice",
				"tournament",
				"live",
				"settled",
				null,
				null,
				null,
				"2026-10-09",
				null,
			],
			[
				"manual-cash",
				"alice",
				"cash",
				"manual",
				"settled",
				"alice-room",
				"alice-currency",
				longTitle,
				"2026-10-08",
				longMemo,
			],
			[
				"manual-mtt",
				"alice",
				"tournament",
				"manual",
				"settled",
				null,
				null,
				"Manual tournament",
				"2026-10-08",
				null,
			],
			[
				"missing-cash",
				"alice",
				"cash",
				"manual",
				"settled",
				null,
				null,
				null,
				"2026-10-08",
				null,
			],
			[
				"missing-mtt",
				"alice",
				"tournament",
				"manual",
				"settled",
				null,
				null,
				null,
				"2026-10-08",
				null,
			],
			[
				"paused",
				"bob",
				"tournament",
				"live",
				"open",
				null,
				null,
				"Paused",
				"2026-10-09",
				null,
			],
		].map((row) => [...row, 1, 2]);
		expect(db.prepare("SELECT * FROM entry ORDER BY id").values()).toEqual(
			expectedEntries
		);
		expect(
			db.prepare("SELECT * FROM entry_cash ORDER BY entry_id").values()
		).toEqual([
			["active", "alice", null, null],
			["bad-cash", "alice", null, 1],
			["live-cash", "alice", "alice-ring", -49],
			["manual-cash", "alice", null, null],
			["missing-cash", "alice", null, null],
		]);
		expect(
			db.prepare("SELECT * FROM entry_tournament ORDER BY entry_id").values()
		).toEqual([
			["bad-mtt", "alice", null, null, 10, null],
			["invalid-placement", "alice", null, null, 5, null],
			["invalid-total", "alice", null, 2, null, null],
			["live-mtt", "alice", "alice-mtt", null, 50, 1],
			["manual-mtt", "alice", null, null, 50, 1],
			["missing-mtt", "alice", null, null, null, null],
			["paused", "bob", null, null, null, null],
		]);
		const plays = [
			[
				"active",
				"alice",
				"cash",
				"2026-10-08",
				late,
				null,
				0,
				"active",
				null,
				null,
				null,
			],
			[
				"bad-cash",
				"alice",
				"cash",
				"2026-10-09",
				nextDay,
				null,
				0,
				"ended",
				"cashed_out",
				null,
				null,
			],
			[
				"bad-mtt",
				"alice",
				"tournament",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"finished",
				null,
				null,
			],
			[
				"invalid-placement",
				"alice",
				"tournament",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"finished",
				null,
				null,
			],
			[
				"invalid-total",
				"alice",
				"tournament",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"busted",
				null,
				null,
			],
			[
				"live-cash",
				"alice",
				"cash",
				"2026-10-08",
				late,
				nextDay,
				5,
				"ended",
				"cashed_out",
				100,
				null,
			],
			[
				"live-mtt",
				"alice",
				"tournament",
				"2026-10-09",
				nextDay,
				nextDay + 60,
				0,
				"ended",
				"busted",
				null,
				nextDay + 10,
			],
			[
				"manual-cash",
				"alice",
				"cash",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"cashed_out",
				150,
				null,
			],
			[
				"manual-mtt",
				"alice",
				"tournament",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"finished",
				null,
				null,
			],
			[
				"missing-cash",
				"alice",
				"cash",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"cashed_out",
				null,
				null,
			],
			[
				"missing-mtt",
				"alice",
				"tournament",
				"2026-10-08",
				null,
				null,
				0,
				"ended",
				"finished",
				null,
				null,
			],
			[
				"paused",
				"bob",
				"tournament",
				"2026-10-09",
				null,
				null,
				3,
				"paused",
				null,
				null,
				nextDay + 20,
			],
		].map(
			([
				id,
				userId,
				kind,
				date,
				start,
				end,
				minutes,
				status,
				endState,
				stack,
				clock,
			]) => [
				id,
				userId,
				id,
				kind,
				1,
				null,
				date,
				start,
				end,
				minutes,
				status,
				endState,
				stack,
				clock,
				null,
				1,
				2,
			]
		);
		expect(
			db.prepare("SELECT * FROM play_session ORDER BY id").values()
		).toEqual(plays);
		expect(db.prepare("SELECT * FROM play_event ORDER BY id").values()).toEqual(
			[
				[
					"broken",
					"alice",
					"live-cash",
					"live-cash",
					"session_end",
					1,
					nextDay,
					0,
					"{}",
					1,
					2,
					null,
				],
				[
					"unknown",
					"alice",
					"live-mtt",
					"live-mtt",
					"legacy_custom_type",
					1,
					nextDay + 30,
					0,
					'{"kept":true}',
					1,
					2,
					null,
				],
			]
		);
		expect(
			[
				"game_session",
				"session_cash_detail",
				"session_tournament_detail",
				"session_event",
			].map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all())
		).toEqual(legacy);
		expect(db.prepare("PRAGMA foreign_key_check").values()).toEqual([]);
		expect(
			db
				.prepare(
					"SELECT name FROM sqlite_master WHERE name = '_migration_check'"
				)
				.all()
		).toEqual([]);
	});

	it.each([
		["missing entry", "DELETE FROM entry WHERE id = 'missing-cash'"],
		[
			"extra entry",
			"INSERT INTO entry (id, user_id, kind, source, status, played_on, updated_at) VALUES ('extra', 'alice', 'cash', 'manual', 'settled', '2026-10-08', 2)",
		],
		["missing seq-1 play", "DELETE FROM play_session WHERE id = 'missing-mtt'"],
		[
			"extra seq-1 play",
			"DELETE FROM play_session WHERE id = 'missing-cash'; INSERT INTO play_session (id, user_id, entry_id, kind, seq, local_date, status, end_state, updated_at) VALUES ('extra-play', 'alice', 'missing-cash', 'cash', 1, '2026-10-08', 'ended', 'finished', 2)",
		],
		["missing event", "DELETE FROM play_event WHERE id = 'broken'"],
		[
			"extra event",
			"INSERT INTO play_event (id, user_id, entry_id, play_session_id, type, occurred_at, sort_order, payload, updated_at) VALUES ('extra-event', 'alice', 'live-cash', 'live-cash', 'session_end', 1, 1, '{}', 2)",
		],
		[
			"changed start",
			"UPDATE play_session SET started_at = started_at - 1 WHERE id = 'live-cash'",
		],
		[
			"changed end",
			"UPDATE play_session SET ended_at = ended_at + 1 WHERE id = 'live-cash'",
		],
		[
			"changed break",
			"UPDATE play_session SET break_minutes = 6 WHERE id = 'live-cash'",
		],
		[
			"changed status",
			"UPDATE play_session SET status = 'paused' WHERE id = 'active'",
		],
	])("stops deployment for %s", (_name, corrupt) => {
		const checkIndex = targetStatements.findIndex((statement) =>
			statement.startsWith("INSERT INTO _migration_check")
		);
		expect(checkIndex).toBeGreaterThan(0);
		apply(db, targetStatements.slice(0, checkIndex));
		db.exec(corrupt);
		expect(() => apply(db, targetStatements.slice(checkIndex))).toThrow(
			NOT_NULL_VIOLATION
		);
	});
});
