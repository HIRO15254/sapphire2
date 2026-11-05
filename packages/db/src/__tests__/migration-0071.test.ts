import { describe, expect, it } from "vitest";
import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET = "0071_entry_tag_tables.sql";
const day = Date.parse("2026-10-08T00:00:00Z") / 1000;

const SESSIONS = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO game_session (id, user_id, kind, source, status, session_date, break_minutes, created_at, updated_at) VALUES
 ('s1', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, 1, 2),
 ('s2', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, 3, 4),
 ('b1', 'bob', 'cash_game', 'manual', 'completed', ${day}, 0, 5, 6);
INSERT INTO session_cash_detail (session_id, buy_in, cash_out, variant, blind1, blind2) VALUES
 ('s1', 100, 150, 'NL Hold''em', 1, 2),
 ('s2', 100, 50, 'NL Hold''em', 1, 2),
 ('b1', 100, 50, 'NL Hold''em', 1, 2);
`;

const TAGS = `
INSERT INTO game_session (id, user_id, kind, source, status, session_date, break_minutes, created_at, updated_at) VALUES
 ('orphan', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, 7, 8);
INSERT INTO session_tag (id, user_id, name, created_at) VALUES
 ('a-live', 'alice', 'Live', 10),
 ('a-live-dup', 'alice', ' live ', 20),
 ('a-deep', 'alice', 'Deep Run', 15),
 ('b-live', 'bob', 'Live', 5);
INSERT INTO session_to_session_tag (session_id, session_tag_id) VALUES
 ('s1', 'a-live'), ('s1', 'a-live-dup'), ('s2', 'a-live-dup'), ('s2', 'a-deep'),
 ('b1', 'a-deep'), ('b1', 'b-live'), ('orphan', 'a-live');
`;

function apply(db: Database, statements: string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

describe("migration 0071 — entry tags", () => {
	it("merges session tags by normalized name into the oldest and remaps links to existing entries of the same owner", () => {
		const db = openDatabase();
		try {
			db.exec("PRAGMA foreign_keys=ON");
			for (const name of migrationFiles("0061_")) {
				apply(db, statementsOf(name));
			}
			db.exec(SESSIONS);
			for (const name of migrationFiles(TARGET).filter(
				(file) => file >= "0061_"
			)) {
				apply(db, statementsOf(name));
			}
			db.exec(TAGS);
			apply(db, statementsOf(TARGET));

			expect(
				values(
					db,
					"SELECT id, user_id, name, sort_order, created_at, updated_at FROM entry_tag ORDER BY user_id, sort_order"
				)
			).toEqual([
				["a-live", "alice", "Live", 0, 10, 10],
				["a-deep", "alice", "Deep Run", 1, 15, 15],
				["b-live", "bob", "Live", 0, 5, 5],
			]);
			expect(
				values(
					db,
					"SELECT user_id, entry_id, tag_id FROM entry_tag_link ORDER BY entry_id, tag_id"
				)
			).toEqual([
				["bob", "b1", "b-live"],
				["alice", "s1", "a-live"],
				["alice", "s2", "a-deep"],
				["alice", "s2", "a-live"],
			]);
			expect(
				values(db, "SELECT name FROM sqlite_master WHERE name LIKE '%0071%'")
			).toEqual([]);
		} finally {
			db.close();
		}
	});
});
