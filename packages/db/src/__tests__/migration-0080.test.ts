import { expect, it } from "vitest";
import {
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

it("renames duplicates without losing rows or colliding with reserved names", () => {
	const db = openDatabase();
	try {
		for (const file of migrationFiles("0080_")) {
			for (const sql of statementsOf(file)) {
				db.exec(sql);
			}
		}
		const insert = db.prepare(
			"INSERT INTO filter_preset (id,user_id,screen_key,name,payload,created_at,updated_at) VALUES (?,?,?,?, '{}',?,1)"
		);
		insert.run("a", "u", "screen", "Morning", 1);
		insert.run("b", "u", "screen", "morning", 2);
		insert.run("c", "u", "screen", "MORNING (2)", 3);
		insert.run("d", "u", "screen", "x".repeat(50), 4);
		insert.run("e", "u", "screen", "X".repeat(50), 5);
		for (const sql of statementsOf("0080_player_preset_indexes.sql")) {
			db.exec(sql);
		}
		expect(
			rowValues(db.prepare("SELECT id,name FROM filter_preset ORDER BY id"))
		).toEqual([
			["a", "Morning"],
			["b", "morning (3)"],
			["c", "MORNING (2)"],
			["d", "x".repeat(50)],
			["e", `${"X".repeat(46)} (2)`],
		]);
		expect(() => insert.run("f", "u", "screen", "MORNING", 6)).toThrow(
			"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
		);
	} finally {
		db.close();
	}
});
