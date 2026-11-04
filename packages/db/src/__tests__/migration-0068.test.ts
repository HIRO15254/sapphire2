import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET = "0068_required_blinds.sql";
const BIG_BET_BLIND3_GATE = /NOT NULL constraint failed: __gate_0068/;
const REQUIRED_FLAG_CHECK = /game_group_blind1_required_check/;

const beforeTarget = migrationFiles(TARGET).map(statementsOf);

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, blind3_label, created_at, updated_at) VALUES
 ('a-limit', 'alice', 'limit', 'Limit', 'Small Bet', 'Big Bet', NULL, 1, 2),
 ('a-stud', 'alice', 'stud', 'Stud', 'Small Bet', 'Big Bet', 'Bring-in', 1, 2),
 ('a-bigbet', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', 'Straddle', 1, 2),
 ('a-custom', 'alice', NULL, 'Custom', 'Small', 'Big', 'Straddle', 1, 2),
 ('b-bigbet', 'bob', 'bigbet', 'Big Bet', NULL, 'BB', 'Button', 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, group_id, sort_order, updated_at) VALUES
 ('a-nlh', 'alice', 'nlh', 'NL Hold''em', 'a-bigbet', 0, 2),
 ('a-stud-hi', 'alice', 'stud', 'Stud', 'a-stud', 1, 2);
INSERT INTO game_lineup (id, user_id) VALUES ('lu-nlh', 'alice'), ('lu-stud', 'alice');
INSERT INTO game_lineup_group (id, user_id, lineup_id, position, game_group_id) VALUES
 ('lg-nlh', 'alice', 'lu-nlh', 0, 'a-bigbet'), ('lg-stud', 'alice', 'lu-stud', 0, 'a-stud');
INSERT INTO game_lineup_variant (user_id, lineup_id, lineup_group_id, variant_id, position) VALUES
 ('alice', 'lu-nlh', 'lg-nlh', 'a-nlh', 0), ('alice', 'lu-stud', 'lg-stud', 'a-stud-hi', 0);
INSERT INTO cash_rule (id, user_id, lineup_id) VALUES ('cr-nlh', 'alice', 'lu-nlh'), ('cr-stud', 'alice', 'lu-stud');
INSERT INTO cash_rule_stake (user_id, rule_id, lineup_group_id, lineup_id, blind1, blind2, blind3) VALUES
 ('alice', 'cr-nlh', 'lg-nlh', 'lu-nlh', 1, 2, NULL),
 ('alice', 'cr-stud', 'lg-stud', 'lu-stud', 10, 20, 100);
INSERT INTO tournament_rule (id, user_id, lineup_id) VALUES ('tr-nlh', 'alice', 'lu-nlh');
INSERT INTO tournament_rule_level (id, user_id, rule_id, ordinal, level, lineup_id, inherits_lineup, inherited_lineup_id) VALUES
 ('tl-1', 'alice', 'tr-nlh', 1, 1, 'lu-nlh', 1, 'lu-nlh');
INSERT INTO tournament_rule_level_stake (user_id, level_id, lineup_group_id, lineup_id, blind1, blind2, blind3) VALUES
 ('alice', 'tl-1', 'lg-nlh', 'lu-nlh', 100, 200, NULL);
`;

function apply(db: Database, statements: string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function groups(db: Database) {
	return rowValues(
		db.prepare(
			"SELECT id, blind1_label, blind2_label, blind3_label, blind1_required, blind2_required, blind3_required FROM game_group ORDER BY id"
		)
	);
}

describe("migration 0068 — required blinds", () => {
	let db: Database;

	beforeEach(() => {
		db = openDatabase();
		db.exec("PRAGMA foreign_keys=ON");
		for (const statements of beforeTarget) {
			apply(db, statements);
		}
		db.exec(SEED);
	});

	afterEach(() => {
		db.close();
	});

	it("sets the built-in flags on labeled fields and removes the built-in Big Bet Straddle", () => {
		apply(db, statementsOf(TARGET));

		expect(groups(db)).toEqual([
			["a-bigbet", "SB", "BB", null, 1, 1, 0],
			["a-custom", "Small", "Big", "Straddle", 0, 0, 0],
			["a-limit", "Small Bet", "Big Bet", null, 1, 1, 0],
			["a-stud", "Small Bet", "Big Bet", "Bring-in", 1, 1, 0],
			["b-bigbet", null, "BB", "Button", 0, 1, 0],
		]);
		expect(() =>
			db.exec("UPDATE game_group SET blind1_required = 2 WHERE id = 'a-custom'")
		).toThrow(REQUIRED_FLAG_CHECK);
	});

	it.each([
		["cash", "UPDATE cash_rule_stake SET blind3 = 5 WHERE rule_id = 'cr-nlh'"],
		[
			"tournament",
			"UPDATE tournament_rule_level_stake SET blind3 = 0 WHERE level_id = 'tl-1'",
		],
	])("aborts before any change when a Big Bet %s stake has a blind3 value", (_kind, dirty) => {
		db.exec(dirty);
		const labels = "SELECT id, blind3_label FROM game_group ORDER BY id";
		const before = rowValues(db.prepare(labels));

		expect(() => apply(db, statementsOf(TARGET))).toThrow(BIG_BET_BLIND3_GATE);
		expect(rowValues(db.prepare(labels))).toEqual(before);
	});
});
