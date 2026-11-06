import { describe, expect, it } from "vitest";
import {
	apply,
	indexDefinitions,
	populatedDatabase,
	tableContents,
	values,
} from "./v2-populated";

const TARGET = "0081_room_player_checks.sql";
const REBUILT = ["room", "player"];
const CHILDREN = [
	"entry",
	"tournament",
	"ring_game",
	"cash_rule",
	"cash_rule_stake",
	"entry_cash",
	"hand_seat",
	"player_tag_link",
];

describe("migration 0081 — room and player CHECKs", () => {
	it("rebuilds room and player with foreign keys on without changing them or any row that references them", () => {
		const db = populatedDatabase(TARGET);
		try {
			expect(
				values(db, "SELECT count(*) FROM ring_game WHERE room_id = 'club'")
			).toEqual([[1]]);
			expect(
				values(db, "SELECT player_id FROM hand_seat WHERE seat = 5")
			).toEqual([["player"]]);
			const before = new Map(
				[...REBUILT, ...CHILDREN].map((table) => [
					table,
					tableContents(db, table),
				])
			);
			const indexes = new Map(
				REBUILT.map((table) => [table, indexDefinitions(db, table)])
			);

			apply(db, TARGET);

			expect(values(db, "PRAGMA foreign_keys")).toEqual([[1]]);
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
			for (const [table, rows] of before) {
				expect(tableContents(db, table), table).toEqual(rows);
			}
			for (const [table, definitions] of indexes) {
				expect(indexDefinitions(db, table), table).toEqual(definitions);
			}
			expect(
				values(
					db,
					"SELECT name FROM sqlite_schema WHERE name LIKE '\\_\\_%' ESCAPE '\\'"
				)
			).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("rejects values the API already refuses", () => {
		const db = populatedDatabase(TARGET);
		try {
			apply(db, TARGET);
			expect(() =>
				db.exec("UPDATE room SET is_favorite = 2 WHERE id = 'club'")
			).toThrow("room_is_favorite_check");
			expect(() =>
				db.exec("UPDATE room SET longitude = NULL WHERE id = 'club'")
			).toThrow("room_coordinates_pair_check");
			expect(() =>
				db.exec("UPDATE room SET latitude = 1 WHERE id = 'bar'")
			).toThrow("room_coordinates_pair_check");
			expect(() =>
				db.exec("UPDATE player SET is_temporary = 2 WHERE id = 'player'")
			).toThrow("player_is_temporary_check");
			db.exec(
				"UPDATE room SET latitude = NULL, longitude = NULL WHERE id = 'club'"
			);
		} finally {
			db.close();
		}
	});

	it("aborts before dropping anything when an existing row violates a new CHECK", () => {
		const db = populatedDatabase(TARGET);
		try {
			db.exec("UPDATE room SET latitude = 1 WHERE id = 'bar'");
			expect(() => apply(db, TARGET)).toThrow(
				"NOT NULL constraint failed: __gate_0081.values_valid"
			);
			expect(values(db, "SELECT count(*) FROM room")).toEqual([[2]]);
			expect(
				values(db, "SELECT count(*) FROM ring_game WHERE room_id = 'club'")
			).toEqual([[1]]);
		} finally {
			db.close();
		}
	});
});
