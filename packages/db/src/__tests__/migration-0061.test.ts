import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";

import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET_MIGRATION = "0061_entry_p1_cutover.sql";
const earlierMigrations = migrationFiles("0061_").map(statementsOf);
const targetStatements = statementsOf(TARGET_MIGRATION);
const gateIndex = targetStatements.findIndex((statement) =>
	statement.startsWith("CREATE TABLE `__gate_0061`")
);

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
INSERT INTO asset (id, user_id, name, updated_at) VALUES
 ('alice-asset', 'alice', 'Chips', 2), ('bob-asset', 'bob', 'Coins', 2);
INSERT INTO ring_game (id, user_id, room_id, currency_id, name, created_at, updated_at) VALUES
 ('alice-ring', 'alice', 'alice-room', 'alice-asset', 'Cash', 1, 2),
 ('bob-ring', 'bob', 'bob-room', 'bob-asset', 'Cash', 1, 2);
INSERT INTO tournament (id, user_id, room_id, currency_id, name, created_at, updated_at) VALUES
 ('alice-mtt', 'alice', 'alice-room', 'alice-asset', 'Daily', 1, 2),
 ('bob-mtt', 'bob', 'bob-room', 'bob-asset', 'Daily', 1, 2);
INSERT INTO game_session
 (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, room_id, currency_id, created_at, updated_at) VALUES
 ('manual-cash', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, 'alice-room', 'alice-asset', 1, 2),
 ('manual-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, 0, NULL, NULL, 1, 2),
 ('live-cash', 'alice', 'cash_game', 'live', 'completed', ${midnight}, ${late}, ${nextDay}, 5, 'alice-room', 'alice-asset', 1, 2),
 ('live-mtt', 'alice', 'tournament', 'live', 'completed', ${midnight}, ${nextDay}, ${nextDay + 60}, 0, NULL, NULL, 1, 2),
 ('active', 'alice', 'cash_game', 'live', 'active', ${midnight}, ${late}, NULL, NULL, NULL, NULL, 1, 2),
 ('paused', 'bob', 'tournament', 'live', 'paused', ${nextDay}, NULL, NULL, 3, NULL, NULL, 1, 2),
 ('bad-cash', 'alice', 'cash_game', 'live', 'completed', ${midnight}, ${nextDay}, ${late}, -5, 'bob-room', 'bob-asset', 1, 2),
 ('bad-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, 0, 'bob-room', 'bob-asset', 1, 2),
 ('missing-cash', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('missing-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('invalid-total', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('invalid-placement', 'alice', 'tournament', 'manual', 'completed', ${midnight}, NULL, NULL, NULL, NULL, NULL, 1, 2),
 ('manual-with-event', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, ${nextDay}, ${nextDay + 60}, 0, NULL, NULL, 1, 2);
INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in, cash_out, ev_cash_out, rule_name) VALUES
 ('manual-cash', NULL, 100, 150, NULL, '${longTitle}'),
 ('live-cash', 'alice-ring', 100, 100, 50.5, 'Cash'),
 ('active', NULL, 100, 100, 200, 'Active'),
 ('bad-cash', 'bob-ring', 100, -1, 0, 'Foreign cash'),
 ('manual-with-event', NULL, 100, 80, NULL, 'Imported');
INSERT INTO session_tournament_detail
 (session_id, tournament_id, placement, total_entries, before_deadline, timer_started_at, rule_name) VALUES
 ('manual-mtt', NULL, 1, 50, 1, NULL, 'Manual tournament'),
 ('live-mtt', 'alice-mtt', 1, 50, 1, ${nextDay + 10}, 'Daily'),
 ('paused', NULL, NULL, NULL, 0, ${nextDay + 20}, 'Paused'),
 ('bad-mtt', 'bob-mtt', 20, 10, 2, NULL, 'Foreign tournament'),
 ('invalid-total', NULL, 2, -1, 0, NULL, 'Invalid total'),
 ('invalid-placement', NULL, 0, 5, NULL, NULL, 'Invalid placement');
UPDATE game_session SET memo = '${longMemo}' WHERE id = 'manual-cash';
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('broken', 'live-cash', 'session_end', ${nextDay}, 0, '{broken', 1, 2),
 ('unknown', 'live-mtt', 'legacy_custom_type', ${nextDay + 30}, 0, '{"kept":true}', 1, 2),
 ('manual-start', 'manual-with-event', 'session_start', ${nextDay}, 0, '{}', 1, 2);
`;

const LEGACY_TABLES = [
	"game_session",
	"session_cash_detail",
	"session_tournament_detail",
	"session_event",
] as const;

const snapshotDirectory = mkdtempSync(
	join(tmpdir(), "sapphire2-migration-0061-")
);
const seededPath = join(snapshotDirectory, "seeded.sqlite");
let databaseIndex = 0;

function seededDatabase(): Database {
	const path = join(snapshotDirectory, `${databaseIndex++}.sqlite`);
	copyFileSync(seededPath, path);
	const db = openDatabase(path);
	db.exec(
		"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
	);
	return db;
}

function apply(db: Database, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function legacyRows(db: Database) {
	return LEGACY_TABLES.map((table) =>
		db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()
	);
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

describe("migration 0061 — entry P1 cutover", () => {
	let db: Database;

	beforeAll(() => {
		const seeded = openDatabase();
		try {
			seeded.exec("PRAGMA foreign_keys=ON");
			for (const statements of earlierMigrations) {
				for (const statement of statements) {
					seeded.exec(statement);
				}
			}
			seeded.exec(SEED);
			seeded.prepare("VACUUM INTO ?").run(seededPath);
		} finally {
			seeded.close();
		}
	});

	afterAll(() => {
		rmSync(snapshotDirectory, { recursive: true, force: true });
	});

	beforeEach(() => {
		db = seededDatabase();
	});

	afterEach(() => db?.close());

	it("moves every session, detail and event with normalized values and no foreign links", () => {
		const legacyBefore = legacyRows(db);

		apply(db);

		expect(
			values(
				db,
				"SELECT id, user_id, kind, source, status, room_id, asset_id, title, played_on, memo, created_at, updated_at FROM entry ORDER BY id"
			)
		).toEqual(
			[
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
					"Foreign cash",
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
					"Foreign tournament",
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
					"alice-asset",
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
					"alice-asset",
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
					"manual-with-event",
					"alice",
					"cash",
					"live",
					"settled",
					null,
					null,
					"Imported",
					"2026-10-09",
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
			].map((row) => [...row, 1, 2])
		);
		expect(
			values(
				db,
				"SELECT entry_id, user_id, kind, ring_game_id, cash_rule_id, ev_diff FROM entry_cash ORDER BY entry_id"
			)
		).toEqual([
			["active", "alice", "cash", null, null, null],
			["bad-cash", "alice", "cash", null, null, 1],
			["live-cash", "alice", "cash", "alice-ring", null, -49],
			["manual-cash", "alice", "cash", null, null, null],
			["manual-with-event", "alice", "cash", null, null, null],
			["missing-cash", "alice", "cash", null, null, null],
		]);
		expect(
			values(
				db,
				"SELECT entry_id, user_id, kind, tournament_id, tournament_rule_id, placement, total_entries, before_deadline FROM entry_tournament ORDER BY entry_id"
			)
		).toEqual([
			["bad-mtt", "alice", "tournament", null, null, null, 10, 0],
			["invalid-placement", "alice", "tournament", null, null, null, 5, 0],
			["invalid-total", "alice", "tournament", null, null, 2, null, 0],
			["live-mtt", "alice", "tournament", "alice-mtt", null, null, 50, 1],
			["manual-mtt", "alice", "tournament", null, null, null, 50, 1],
			["missing-mtt", "alice", "tournament", null, null, null, null, 0],
			["paused", "bob", "tournament", null, null, null, null, 0],
		]);
		expect(
			values(
				db,
				"SELECT id, user_id, entry_id, kind, seq, label, local_date, started_at, ended_at, break_minutes, status, end_state, end_stack, clock_started_at, clock_start_level, created_at, updated_at FROM play_session ORDER BY id"
			)
		).toEqual(
			[
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
					"manual-with-event",
					"alice",
					"cash",
					"2026-10-09",
					nextDay,
					nextDay + 60,
					0,
					"ended",
					"cashed_out",
					80,
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
			)
		);
		expect(
			values(
				db,
				"SELECT id, user_id, entry_id, entry_source, play_session_id, type, schema_version, occurred_at, sort_order, payload, created_at, updated_at, hand_id FROM play_event ORDER BY id"
			)
		).toEqual([
			[
				"broken",
				"alice",
				"live-cash",
				"live",
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
				"manual-start",
				"alice",
				"manual-with-event",
				"live",
				"manual-with-event",
				"session_start",
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
				"live",
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
		]);
		expect(legacyRows(db)).toEqual(legacyBefore);
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
		expect(
			values(
				db,
				"SELECT name FROM sqlite_master WHERE name LIKE '\\_\\_%' ESCAPE '\\'"
			)
		).toEqual([]);
	});

	it.each([
		[
			"a missing entry",
			"ids_match",
			"DELETE FROM entry WHERE id = 'missing-cash'",
		],
		[
			"an extra entry",
			"ids_match",
			"INSERT INTO entry (id, user_id, kind, source, status, played_on, updated_at) VALUES ('extra', 'alice', 'cash', 'manual', 'settled', '2026-10-08', 2)",
		],
		[
			"a missing seq-1 day",
			"ids_match",
			"DELETE FROM play_session WHERE id = 'missing-mtt'",
		],
		[
			"an extra day",
			"ids_match",
			"INSERT INTO play_session (id, user_id, entry_id, kind, seq, local_date, status, end_state, updated_at) VALUES ('extra-day', 'alice', 'missing-cash', 'cash', 2, '2026-10-08', 'ended', 'finished', 2)",
		],
		[
			"a missing event",
			"ids_match",
			"DELETE FROM play_event WHERE id = 'broken'",
		],
		[
			"an extra event",
			"ids_match",
			"INSERT INTO play_event (id, user_id, entry_id, entry_source, play_session_id, type, schema_version, occurred_at, sort_order, payload, updated_at) VALUES ('extra-event', 'alice', 'live-cash', 'live', 'live-cash', 'session_end', 1, 1, 1, '{}', 2)",
		],
		[
			"an undeclared source change",
			"ids_match",
			"UPDATE entry SET source = 'manual' WHERE id = 'bad-cash'",
		],
		[
			"a changed start",
			"seq1_matches",
			"UPDATE play_session SET started_at = started_at - 1 WHERE id = 'live-cash'",
		],
		[
			"a changed end",
			"seq1_matches",
			"UPDATE play_session SET ended_at = ended_at + 1 WHERE id = 'live-cash'",
		],
		[
			"a changed break",
			"seq1_matches",
			"UPDATE play_session SET break_minutes = 6 WHERE id = 'live-cash'",
		],
		[
			"a changed status",
			"seq1_matches",
			"UPDATE play_session SET status = 'paused' WHERE id = 'active'",
		],
		[
			"a dangling foreign key",
			"foreign_keys_valid",
			"PRAGMA foreign_keys=OFF; INSERT INTO entry_cash (entry_id, user_id, kind) VALUES ('ghost', 'alice', 'cash'); PRAGMA foreign_keys=ON",
		],
	])("stops the deploy on %s", (_name, gate, corrupt) => {
		expect(gateIndex).toBeGreaterThan(0);
		apply(db, targetStatements.slice(0, gateIndex));
		db.exec(corrupt);

		expect(() => apply(db, targetStatements.slice(gateIndex))).toThrow(
			`NOT NULL constraint failed: __gate_0061.${gate}`
		);
	});
});
