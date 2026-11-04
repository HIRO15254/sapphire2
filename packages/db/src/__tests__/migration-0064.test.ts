import { describe, expect, it } from "vitest";

import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const day = Date.parse("2026-10-08T00:00:00Z") / 1000;

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test'),
 ('carol', 'Carol', 'carol@example.test');
INSERT INTO asset (id, user_id, name, updated_at) VALUES
 ('alice-jpy', 'alice', 'JPY', 2), ('bob-jpy', 'bob', 'JPY', 2), ('carol-jpy', 'carol', 'JPY', 2);
INSERT INTO game_session
 (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, currency_id, created_at, updated_at) VALUES
 ('half-up', 'alice', 'cash_game', 'live', 'active', ${day}, ${day + 60}, NULL, NULL, 'alice-jpy', 1, 2),
 ('half-down', 'bob', 'cash_game', 'live', 'paused', ${day}, ${day + 60}, NULL, NULL, 'bob-jpy', 1, 2),
 ('no-all-in', 'carol', 'cash_game', 'live', 'active', ${day}, ${day + 60}, NULL, NULL, 'carol-jpy', 1, 2),
 ('settled', 'alice', 'cash_game', 'live', 'completed', ${day}, ${day + 60}, ${day + 600}, 0, 'alice-jpy', 1, 2);
INSERT INTO session_cash_detail (session_id, buy_in, cash_out, ev_cash_out) VALUES
 ('half-up', 100, NULL, NULL), ('half-down', 100, NULL, NULL),
 ('no-all-in', 100, NULL, NULL), ('settled', 100, 150, NULL);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('half-up-start', 'half-up', 'session_start', ${day + 60}, 1, '{"buyInAmount":100}', 1, 2),
 ('half-up-a', 'half-up', 'all_in', ${day + 120}, 2, '{"potSize":1000,"trials":1,"equity":40,"wins":0}', 1, 2),
 ('half-up-b', 'half-up', 'all_in', ${day + 180}, 3, '{"potSize":101,"trials":1,"equity":50,"wins":0}', 1, 2),
 ('half-down-start', 'half-down', 'session_start', ${day + 60}, 1, '{"buyInAmount":100}', 1, 2),
 ('half-down-a', 'half-down', 'all_in', ${day + 120}, 2, '{"potSize":3,"trials":1,"equity":50,"wins":1}', 1, 2),
 ('half-down-pause', 'half-down', 'session_pause', ${day + 300}, 3, '{}', 1, 2),
 ('no-all-in-start', 'no-all-in', 'session_start', ${day + 60}, 1, '{"buyInAmount":100}', 1, 2),
 ('settled-start', 'settled', 'session_start', ${day + 60}, 1, '{"buyInAmount":100}', 1, 2),
 ('settled-a', 'settled', 'all_in', ${day + 120}, 2, '{"potSize":10,"trials":1,"equity":50,"wins":0}', 1, 2),
 ('settled-end', 'settled', 'session_end', ${day + 600}, 3, '{"cashOutAmount":150}', 1, 2);
`;

function apply(db: Database, statements: readonly string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function migratedDatabase(): Database {
	const db = openDatabase();
	db.exec("PRAGMA foreign_keys=ON");
	for (const file of migrationFiles("0061_")) {
		apply(db, statementsOf(file));
	}
	db.exec(SEED);
	for (const file of migrationFiles("0064_").filter(
		(name) => name >= "0061_"
	)) {
		apply(db, statementsOf(file));
	}
	return db;
}

describe("migration 0064 — open live cash EV", () => {
	it("projects ev_diff for open live cash entries as the rounded running sum of their all-ins, leaving settled entries alone", () => {
		const db = migratedDatabase();
		try {
			expect(
				rowValues(
					db.prepare(
						"SELECT entry_id, ev_diff FROM entry_cash ORDER BY entry_id"
					)
				)
			).toEqual([
				["half-down", null],
				["half-up", null],
				["no-all-in", null],
				["settled", 5],
			]);
			db.exec("UPDATE entry_cash SET ev_diff = 99 WHERE entry_id = 'settled'");

			apply(db, statementsOf("0064_open_live_cash_ev.sql"));

			expect(
				rowValues(
					db.prepare(
						"SELECT entry_id, ev_diff FROM entry_cash ORDER BY entry_id"
					)
				)
			).toEqual([
				["half-down", -1],
				["half-up", 451],
				["no-all-in", 0],
				["settled", 99],
			]);
		} finally {
			db.close();
		}
	});
});
