import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET = "0084_fixed_ante_type.sql";
const FIXED_ANTE_CHECK = /game_group_fixed_ante_type_check/u;

const beforeTarget = migrationFiles(TARGET).map(statementsOf);

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, blind3_label, created_at, updated_at) VALUES
 ('a-limit', 'alice', 'limit', 'Limit', 'Small Bet', 'Big Bet', NULL, 1, 2),
 ('a-stud', 'alice', 'stud', 'Stud', 'Small Bet', 'Big Bet', 'Bring-in', 1, 2),
 ('a-bigbet', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', NULL, 1, 2),
 ('a-custom', 'alice', NULL, 'Custom Stud', 'Small Bet', 'Big Bet', 'Bring-in', 1, 2),
 ('b-stud', 'bob', 'stud', 'Stud', 'Small Bet', 'Big Bet', 'Bring-in', 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, group_id, sort_order, updated_at) VALUES
 ('a-nlh', 'alice', 'nlh', 'NL Hold''em', 'a-bigbet', 0, 2),
 ('a-stud-hi', 'alice', 'stud', 'Stud', 'a-stud', 1, 2),
 ('a-razz', 'alice', NULL, 'Custom', 'a-custom', 2, 2),
 ('b-stud-hi', 'bob', 'stud', 'Stud', 'b-stud', 0, 2);
INSERT INTO game_lineup (id, user_id) VALUES
 ('lu-mix', 'alice'), ('lu-custom', 'alice'), ('lu-b', 'bob');
INSERT INTO game_lineup_group (id, user_id, lineup_id, position, game_group_id) VALUES
 ('lg-nlh', 'alice', 'lu-mix', 0, 'a-bigbet'), ('lg-stud', 'alice', 'lu-mix', 1, 'a-stud'),
 ('lg-custom', 'alice', 'lu-custom', 0, 'a-custom'), ('lg-b', 'bob', 'lu-b', 0, 'b-stud');
INSERT INTO game_lineup_variant (user_id, lineup_id, lineup_group_id, variant_id, position) VALUES
 ('alice', 'lu-mix', 'lg-nlh', 'a-nlh', 0), ('alice', 'lu-mix', 'lg-stud', 'a-stud-hi', 1),
 ('alice', 'lu-custom', 'lg-custom', 'a-razz', 0), ('bob', 'lu-b', 'lg-b', 'b-stud-hi', 0);
INSERT INTO cash_rule (id, user_id, lineup_id) VALUES
 ('cr-mix', 'alice', 'lu-mix'), ('cr-custom', 'alice', 'lu-custom'), ('cr-b', 'bob', 'lu-b');
INSERT INTO cash_rule_stake (user_id, rule_id, lineup_group_id, lineup_id, blind1, blind2, ante, ante_type) VALUES
 ('alice', 'cr-mix', 'lg-nlh', 'lu-mix', 1, 2, 2, 'bb'),
 ('alice', 'cr-mix', 'lg-stud', 'lu-mix', 10, 20, 5, 'bb'),
 ('alice', 'cr-custom', 'lg-custom', 'lu-custom', 10, 20, NULL, NULL),
 ('bob', 'cr-b', 'lg-b', 'lu-b', 10, 20, NULL, NULL);
INSERT INTO tournament_rule (id, user_id, lineup_id) VALUES ('tr-mix', 'alice', 'lu-mix');
INSERT INTO tournament_rule_level (id, user_id, rule_id, ordinal, level, lineup_id, inherits_lineup, inherited_lineup_id) VALUES
 ('tl-1', 'alice', 'tr-mix', 1, 1, 'lu-mix', 1, 'lu-mix');
INSERT INTO tournament_rule_level_stake (user_id, level_id, lineup_group_id, lineup_id, blind1, blind2, ante, ante_type) VALUES
 ('alice', 'tl-1', 'lg-nlh', 'lu-mix', 100, 200, 200, 'bb'),
 ('alice', 'tl-1', 'lg-stud', 'lu-mix', 100, 200, 25, 'none');
`;

function apply(db: Database, statements: string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

describe("migration 0084 — fixed ante type per structure", () => {
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

	it("fixes every built-in Stud to all and aligns the stakes saved on it", () => {
		apply(db, statementsOf(TARGET));

		expect(
			rowValues(
				db.prepare("SELECT id, fixed_ante_type FROM game_group ORDER BY id")
			)
		).toEqual([
			["a-bigbet", null],
			["a-custom", null],
			["a-limit", null],
			["a-stud", "all"],
			["b-stud", "all"],
		]);
		expect(
			rowValues(
				db.prepare(
					"SELECT rule_id, lineup_group_id, ante, ante_type FROM cash_rule_stake ORDER BY rule_id, lineup_group_id"
				)
			)
		).toEqual([
			["cr-b", "lg-b", null, "all"],
			["cr-custom", "lg-custom", null, null],
			["cr-mix", "lg-nlh", 2, "bb"],
			["cr-mix", "lg-stud", 5, "all"],
		]);
		expect(
			rowValues(
				db.prepare(
					"SELECT lineup_group_id, ante, ante_type FROM tournament_rule_level_stake ORDER BY lineup_group_id"
				)
			)
		).toEqual([
			["lg-nlh", 200, "bb"],
			["lg-stud", 25, "all"],
		]);
		expect(() =>
			db.exec(
				"UPDATE game_group SET fixed_ante_type = 'x' WHERE id = 'a-custom'"
			)
		).toThrow(FIXED_ANTE_CHECK);
	});
});
