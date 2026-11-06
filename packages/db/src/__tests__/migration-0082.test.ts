import { describe, expect, it } from "vitest";
import {
	apply,
	indexDefinitions,
	populatedDatabase,
	tableContents,
	values,
} from "./v2-populated";

const TARGET = "0082_session_hand_event_checks.sql";
const REBUILT = ["play_session", "hand", "play_event"];
const CHILDREN = [
	"ledger_line",
	"hand_board",
	"hand_seat",
	"hand_action",
	"hand_tag_link",
];

describe("migration 0082 — play_session, hand and play_event CHECKs", () => {
	it("rebuilds the three tables with foreign keys on without changing them, their ledger lines or hand details", () => {
		const db = populatedDatabase(TARGET);
		try {
			expect(
				values(
					db,
					"SELECT count(*) FROM ledger_line WHERE source_event_id IS NOT NULL"
				)
			).toEqual([[2]]);
			expect(values(db, "SELECT id, seq FROM hand ORDER BY id")).toEqual([
				["h1", 1],
				["h2", 2],
			]);
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

	it("rejects values the API already refuses and still accepts NULL levels", () => {
		const db = populatedDatabase(TARGET);
		try {
			apply(db, TARGET);
			expect(() =>
				db.exec("UPDATE hand SET level_ordinal = 0 WHERE id = 'h1'")
			).toThrow("hand_level_ordinal_check");
			expect(() =>
				db.exec("UPDATE play_event SET sort_order = -1 WHERE id = 'live-start'")
			).toThrow("play_event_sort_order_check");
			expect(() =>
				db.exec(
					"UPDATE play_session SET clock_start_level = 0 WHERE id = 'tournament-entry'"
				)
			).toThrow("play_session_clock_start_level_check");
			db.exec("UPDATE hand SET level_ordinal = NULL WHERE id = 'h1'");
			db.exec(
				"UPDATE play_session SET clock_start_level = NULL WHERE id = 'tournament-entry'"
			);
		} finally {
			db.close();
		}
	});

	it("aborts before dropping anything when an existing row violates a new CHECK", () => {
		const db = populatedDatabase(TARGET);
		try {
			db.exec("UPDATE hand SET level_ordinal = 0 WHERE id = 'h2'");
			expect(() => apply(db, TARGET)).toThrow(
				"NOT NULL constraint failed: __gate_0082.values_valid"
			);
			expect(values(db, "SELECT count(*) FROM hand_action")).toEqual([[2]]);
			expect(
				values(
					db,
					"SELECT count(*) FROM ledger_line WHERE source_event_id IS NOT NULL"
				)
			).toEqual([[2]]);
		} finally {
			db.close();
		}
	});
});
