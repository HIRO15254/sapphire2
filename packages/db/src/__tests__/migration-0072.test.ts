import { describe, expect, it } from "vitest";
import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET = "0072_tag_tables.sql";
const SEED = `
INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES ('room', 'alice', 'Club', 2), ('bob-room', 'bob', 'Club', 2);
INSERT INTO asset (id, user_id, name, updated_at) VALUES ('jpy', 'alice', 'JPY', 2), ('bob-jpy', 'bob', 'JPY', 2);
INSERT INTO tournament (id, user_id, room_id, currency_id, name, created_at, updated_at) VALUES
 ('t1', 'alice', 'room', 'jpy', 'One', 1, 2), ('t2', 'alice', 'room', 'jpy', 'Two', 1, 2), ('bt', 'bob', 'bob-room', 'bob-jpy', 'Bob', 1, 2);
INSERT INTO tournament_tag (id, tournament_id, name, created_at) VALUES
 ('z', 't1', 'MAIN EVENT', 10), ('a', 't2', 'Main Event', 10), ('later', 't1', ' main event ', 20), ('other', 't1', 'Turbo', 15), ('bob', 'bt', 'Main Event', 5);
INSERT INTO player (id, user_id, name, created_at, updated_at) VALUES
 ('p1', 'alice', 'One', 1, 2), ('p2', 'alice', 'Two', 1, 2), ('bp', 'bob', 'Bob', 1, 2);
INSERT INTO player_tag (id, user_id, name, color, created_at, updated_at) VALUES
 ('old', 'alice', 'Loose', 'red', 10, 10), ('dup', 'alice', ' loose ', 'blue', 20, 20), ('other', 'alice', 'Tight', 'green', 15, 15), ('bob', 'bob', 'Loose', 'yellow', 5, 5);
INSERT INTO player_to_player_tag (player_id, player_tag_id, position) VALUES
 ('p1', 'old', 8), ('p1', 'dup', 3), ('p2', 'dup', 7), ('p2', 'other', 4), ('p1', 'bob', 9), ('bp', 'bob', 2);
`;

function apply(db: Database, statements: string[]) {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function seeded(): Database {
	const db = openDatabase();
	db.exec("PRAGMA foreign_keys=ON");
	for (const name of migrationFiles("0061_")) {
		apply(db, statementsOf(name));
	}
	db.exec(SEED);
	for (const name of migrationFiles(TARGET).filter((file) => file >= "0061_")) {
		apply(db, statementsOf(name));
	}
	return db;
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

describe("migration 0072 — tournament and player tags", () => {
	it("merges names per owner, preserves player identities and positions, and remaps links", () => {
		const db = seeded();
		try {
			apply(db, statementsOf(TARGET));
			expect(
				values(
					db,
					"SELECT id, user_id, name, sort_order, created_at, updated_at FROM tournament_tag_def ORDER BY user_id, sort_order"
				)
			).toEqual([
				["tt:alice:6D61696E206576656E74", "alice", "Main Event", 0, 10, 10],
				["tt:alice:747572626F", "alice", "Turbo", 1, 15, 15],
				["tt:bob:6D61696E206576656E74", "bob", "Main Event", 0, 5, 5],
			]);
			expect(
				values(
					db,
					"SELECT user_id, tournament_id, tag_id FROM tournament_tag_link ORDER BY tournament_id, tag_id"
				)
			).toEqual([
				["bob", "bt", "tt:bob:6D61696E206576656E74"],
				["alice", "t1", "tt:alice:6D61696E206576656E74"],
				["alice", "t1", "tt:alice:747572626F"],
				["alice", "t2", "tt:alice:6D61696E206576656E74"],
			]);
			expect(
				values(
					db,
					"SELECT id, user_id, name, color, sort_order FROM player_tag ORDER BY user_id, sort_order"
				)
			).toEqual([
				["old", "alice", "Loose", "red", 0],
				["other", "alice", "Tight", "green", 1],
				["bob", "bob", "Loose", "yellow", 0],
			]);
			expect(
				values(
					db,
					"SELECT user_id, player_id, tag_id, position FROM player_tag_link ORDER BY player_id, tag_id"
				)
			).toEqual([
				["bob", "bp", "bob", 2],
				["alice", "p1", "old", 3],
				["alice", "p2", "old", 7],
				["alice", "p2", "other", 4],
			]);
			expect(
				values(
					db,
					"SELECT player_id, player_tag_id, position FROM player_to_player_tag ORDER BY player_id, player_tag_id"
				)
			).toEqual([
				["bp", "bob", 2],
				["p1", "bob", 9],
				["p1", "old", 8],
				["p2", "old", 7],
				["p2", "other", 4],
			]);
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
			expect(
				values(db, "SELECT name FROM sqlite_master WHERE name LIKE '%0072%'")
			).toEqual([]);
		} finally {
			db.close();
		}
	});

	it.each([
		["tournament_links", "tournament_tag_link"],
		["player_links", "player_tag_link"],
	])("rejects missing %s at its gate", (gate, table) => {
		const db = seeded();
		try {
			let found = false;
			expect(() => {
				for (const statement of statementsOf(TARGET)) {
					if (statement.includes(`INSERT INTO \`__gate_0072\` (\`${gate}\`)`)) {
						found = true;
						db.exec(
							`DELETE FROM ${table} WHERE rowid = (SELECT rowid FROM ${table} LIMIT 1)`
						);
					}
					db.exec(statement);
				}
			}).toThrow(`NOT NULL constraint failed: __gate_0072.${gate}`);
			expect(found).toBe(true);
		} finally {
			db.close();
		}
	});
});
