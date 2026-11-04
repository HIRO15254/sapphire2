import { describe, expect, it } from "vitest";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
} from "../constants/game-variants";

import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const TARGET = "0066_ring_game_rule_versions.sql";
const PRECONDITION_GATE = /NOT NULL constraint failed: __gate_0066/;

function apply(db: Database, statements: string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function values(db: Database, sql: string): unknown[] {
	return rowValues(db.prepare(sql));
}

describe("migration 0066 — ring game rule versions", () => {
	it("preserves legacy rules and inbound links with foreign keys enabled", () => {
		const db = openDatabase();
		try {
			db.exec("PRAGMA foreign_keys=ON");
			for (const file of migrationFiles(TARGET)) {
				apply(db, statementsOf(file));
			}
			db.exec(`
				INSERT INTO user (id, name, email) VALUES
				 ('alice', 'Alice', 'alice@example.test'),
				 ('bob', 'Bob', 'bob@example.test'),
				 ('charlie', 'Charlie', 'charlie@example.test'),
				 ('dana', 'Dana', 'dana@example.test');
				INSERT INTO asset (id, user_id, name, updated_at) VALUES
				 ('alice-asset', 'alice', 'Chips', 2), ('bob-asset', 'bob', 'Chips', 2);
				INSERT INTO game_group (id, user_id, builtin_key, label, updated_at) VALUES
				 ('bigbet', 'alice', 'bigbet', 'Big Bet', 2),
				 ('stud', 'alice', NULL, 'Stud', 2);
				INSERT INTO game_variant (id, user_id, builtin_key, label, group_id, sort_order, updated_at) VALUES
				 ('nlh', 'alice', 'nlh', 'NL Hold''em', 'bigbet', 0, 2),
				 ('plo', 'alice', 'plo', 'Pot Limit Omaha', 'bigbet', 1, 2),
				 ('razz', 'alice', NULL, 'Razz', 'stud', 2, 2);
				INSERT INTO game_mix (id, user_id, label, games, updated_at) VALUES
				 ('rotation', 'alice', 'Rotation', '[]', 2);
				INSERT INTO game_mix_variant (mix_id, variant_id, user_id, position) VALUES
				 ('rotation', 'plo', 'alice', 0);
				INSERT INTO ring_game (id, user_id, name, variant, mix_games, blind1, blind2, ante, ante_type, min_buy_in, max_buy_in, table_size, currency_id, memo, house_rules, archived_at, created_at, updated_at) VALUES
				 ('single', 'alice', 'Single', ' nl HOLD''EM ', NULL, 1, 2, 3, 'bb', 100, 500, 9, 'alice-asset', 'memo', 'rules', 7, 10, 11),
				 ('named', 'alice', 'Named', ' Rotation ', '[{"name":"Big Bet","variants":["nlh","Razz"],"blind1":10,"blind2":20}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('custom', 'alice', 'Custom', 'mix', '[{"variants":["Pot Limit Omaha","Missing"," missing ",42],"blind1":5,"blind2":10},{"variants":["Razz"],"ante":2}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('unknown', 'bob', 'Unknown', 'Mystery', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('unknown-again', 'bob', 'Unknown Again', ' mystery ', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('builtin', 'charlie', 'Builtin', 'mix', '[{"variants":["nlh"]}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('cross-owner', 'alice', 'Cross Owner', 'nlh', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'bob-asset', NULL, NULL, NULL, 10, 11),
				 ('broken', 'alice', 'Broken', 'mix', '{bad json', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('absent-mix', 'alice', 'Absent Mix', 'Lost Rotation', '[{"variants":["nlh","Razz"],"blind1":4,"blind2":8}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('malformed', 'alice', 'Malformed', 'mix', '[{"variants":["nlh",null,{"x":1}]},null,{"variants":42},{"variants":{"x":"Razz"}}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11),
				 ('horse', 'dana', 'Horse', 'HORSE', '[{"variants":["Limit Hold''em"],"blind1":2,"blind2":4}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 11);
				INSERT INTO game_session (id, user_id, kind, source, status, session_date, created_at, updated_at) VALUES
				 ('session', 'alice', 'cash_game', 'manual', 'completed', 1791417600, 1, 2);
				INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in, cash_out) VALUES
				 ('session', 'single', 100, 150);
				INSERT INTO entry (id, user_id, kind, source, status, played_on, updated_at) VALUES
				 ('entry', 'alice', 'cash', 'manual', 'settled', '2026-10-08', 2);
				INSERT INTO entry_cash (entry_id, user_id, kind, ring_game_id, ev_diff) VALUES
				 ('entry', 'alice', 'cash', 'single', 12);
			`);
			const sessionBefore = values(
				db,
				"SELECT * FROM session_cash_detail ORDER BY session_id"
			);
			const entryBefore = values(
				db,
				"SELECT * FROM entry_cash ORDER BY entry_id"
			);

			apply(db, statementsOf(TARGET));

			expect(values(db, "PRAGMA foreign_keys")).toEqual([[1]]);
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
			expect(
				values(db, "SELECT * FROM session_cash_detail ORDER BY session_id")
			).toEqual(sessionBefore);
			expect(values(db, "SELECT * FROM entry_cash ORDER BY entry_id")).toEqual(
				entryBefore
			);
			expect(
				values(db, "SELECT id, current_rule_id FROM ring_game ORDER BY id")
			).toEqual([
				["absent-mix", "cr:absent-mix"],
				["broken", "cr:broken"],
				["builtin", "cr:builtin"],
				["cross-owner", "cr:cross-owner"],
				["custom", "cr:custom"],
				["horse", "cr:horse"],
				["malformed", "cr:malformed"],
				["named", "cr:named"],
				["single", "cr:single"],
				["unknown", "cr:unknown"],
				["unknown-again", "cr:unknown-again"],
			]);
			expect(
				values(
					db,
					"SELECT room_id, default_asset_id, memo, archived_at, created_at, updated_at FROM ring_game WHERE id = 'single'"
				)
			).toEqual([[null, "alice-asset", "memo", 7, 10, 11]]);
			expect(
				values(
					db,
					"SELECT default_asset_id FROM ring_game WHERE id = 'cross-owner'"
				)
			).toEqual([[null]]);
			expect(
				values(
					db,
					"SELECT id, builtin_key, games, archived_at IS NOT NULL FROM game_mix WHERE id = 'standin-mix:alice:lost rotation'"
				)
			).toEqual([["standin-mix:alice:lost rotation", null, "[]", 1]]);
			expect(
				values(
					db,
					"SELECT game_mix_id FROM game_lineup WHERE id = 'lu:cr:absent-mix'"
				)
			).toEqual([["standin-mix:alice:lost rotation"]]);
			expect(
				values(
					db,
					"SELECT variant_id FROM game_mix_variant WHERE mix_id = 'standin-mix:alice:lost rotation' ORDER BY position"
				)
			).toEqual([["nlh"], ["razz"]]);
			expect(
				values(
					db,
					"SELECT ring_game_id, parent_rule_id, lineup_id, min_buy_in, max_buy_in, table_size, house_rules FROM cash_rule WHERE id = 'cr:single'"
				)
			).toEqual([["single", null, "lu:cr:single", 100, 500, 9, "rules"]]);
			expect(
				values(
					db,
					"SELECT blind1, blind2, ante, ante_type FROM cash_rule_stake WHERE rule_id = 'cr:single'"
				)
			).toEqual([[1, 2, 3, "bb"]]);
			expect(
				values(
					db,
					"SELECT game_mix_id FROM game_lineup WHERE id IN ('lu:cr:named', 'lu:cr:custom') ORDER BY id"
				)
			).toEqual([[null], ["rotation"]]);
			expect(
				values(
					db,
					"SELECT v.variant_id FROM game_lineup_variant v JOIN game_lineup_group g ON g.id = v.lineup_group_id WHERE v.lineup_id = 'lu:cr:named' ORDER BY g.position, v.position"
				)
			).toEqual([["nlh"], ["razz"]]);
			expect(
				values(
					db,
					"SELECT game_group_id, name FROM game_lineup_group WHERE lineup_id = 'lu:cr:named'"
				)
			).toEqual([["bigbet", null]]);
			expect(
				values(
					db,
					"SELECT variant_id FROM game_lineup_variant WHERE lineup_id = 'lu:cr:single'"
				)
			).toEqual([["nlh"]]);
			expect(
				values(
					db,
					"SELECT id, group_id, builtin_key, short_label, archived_at IS NOT NULL FROM game_variant WHERE id = 'standin-variant:alice:missing'"
				)
			).toEqual([["standin-variant:alice:missing", "bigbet", null, null, 1]]);
			expect(
				values(
					db,
					"SELECT id, builtin_key, archived_at IS NOT NULL FROM game_variant WHERE id = 'standin-variant:bob:mystery'"
				)
			).toEqual([["standin-variant:bob:mystery", null, 1]]);
			expect(
				values(
					db,
					"SELECT lineup_id, variant_id FROM game_lineup_variant WHERE lineup_id IN ('lu:cr:unknown', 'lu:cr:unknown-again') ORDER BY lineup_id"
				)
			).toEqual([
				["lu:cr:unknown", "standin-variant:bob:mystery"],
				["lu:cr:unknown-again", "standin-variant:bob:mystery"],
			]);
			expect(
				values(
					db,
					"SELECT id, builtin_key, label, short_label, archived_at FROM game_variant WHERE id = 'charlie:builtin-variant:nlh'"
				)
			).toEqual([
				["charlie:builtin-variant:nlh", "nlh", "NL Hold'em", "NLH", null],
			]);
			expect(
				values(
					db,
					"SELECT variant_id FROM game_lineup_variant WHERE lineup_id = 'lu:cr:builtin'"
				)
			).toEqual([["charlie:builtin-variant:nlh"]]);
			expect(
				values(
					db,
					"SELECT l.game_mix_id, v.variant_id FROM game_lineup l JOIN game_lineup_variant v ON v.lineup_id = l.id WHERE l.id = 'lu:cr:horse'"
				)
			).toEqual([["dana:builtin-mix:horse", "dana:builtin-variant:lhe"]]);
			expect(
				values(
					db,
					"SELECT id FROM game_mix WHERE user_id = 'dana' AND id LIKE 'standin-%'"
				)
			).toEqual([]);
			for (const owner of ["bob", "charlie", "dana"]) {
				expect(
					values(
						db,
						`SELECT id, builtin_key, label, blind1_label, blind2_label, blind3_label FROM game_group WHERE user_id = '${owner}' ORDER BY id`
					)
				).toEqual(
					DEFAULT_GAME_GROUPS.map((group) => [
						`${owner}:builtin-group:${group.key}`,
						group.key,
						group.label,
						group.blind1Label,
						group.blind2Label,
						group.blind3Label,
					]).toSorted((a, b) => String(a[0]).localeCompare(String(b[0])))
				);
				expect(
					values(
						db,
						`SELECT builtin_key, label, short_label, group_id, sort_order FROM game_variant WHERE user_id = '${owner}' AND builtin_key IS NOT NULL ORDER BY sort_order`
					)
				).toEqual(
					DEFAULT_GAME_VARIANTS.map((variant, index) => [
						variant.key,
						variant.label,
						variant.shortLabel,
						`${owner}:builtin-group:${variant.groupKey}`,
						index,
					])
				);
				for (const mix of DEFAULT_GAME_MIXES) {
					expect(
						values(
							db,
							`SELECT v.builtin_key FROM game_mix m JOIN game_mix_variant j ON j.mix_id = m.id JOIN game_variant v ON v.id = j.variant_id WHERE m.user_id = '${owner}' AND m.builtin_key = '${mix.key}' AND m.label = '${mix.label}' AND m.archived_at IS NULL ORDER BY j.position`
						)
					).toEqual(mix.variantKeys.map((key) => [key]));
				}
			}
			expect(
				values(
					db,
					"SELECT variant_id FROM game_lineup_variant WHERE lineup_id = 'lu:cr:malformed'"
				)
			).toEqual([["nlh"]]);
			expect(
				values(
					db,
					"SELECT r.id FROM cash_rule r JOIN game_lineup_group g ON g.lineup_id = r.lineup_id LEFT JOIN cash_rule_stake s ON s.rule_id = r.id AND s.lineup_group_id = g.id GROUP BY r.id, g.id HAVING count(s.rule_id) <> 1"
				)
			).toEqual([]);
			expect(
				values(
					db,
					"SELECT r.id FROM ring_game r LEFT JOIN cash_rule c ON c.id = r.current_rule_id AND c.user_id = r.user_id AND c.ring_game_id = r.id WHERE c.id IS NULL"
				)
			).toEqual([]);
			expect(() =>
				db.exec(
					"UPDATE ring_game SET default_asset_id = 'bob-asset' WHERE id = 'single'"
				)
			).toThrow();
			expect(() =>
				db.exec(
					"UPDATE ring_game SET current_rule_id = 'cr:unknown' WHERE id = 'single'"
				)
			).toThrow();
		} finally {
			db.close();
		}
	});
	it("aborts before rebuilding when a cash rule already exists", () => {
		const db = openDatabase();
		try {
			db.exec("PRAGMA foreign_keys=ON");
			for (const file of migrationFiles(TARGET)) {
				apply(db, statementsOf(file));
			}
			db.exec(`
				INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.test');
				INSERT INTO game_lineup (id, user_id) VALUES ('existing-lineup', 'alice');
				INSERT INTO cash_rule (id, user_id, lineup_id) VALUES ('existing-rule', 'alice', 'existing-lineup');
			`);
			expect(() => apply(db, statementsOf(TARGET))).toThrow(PRECONDITION_GATE);
			expect(values(db, "SELECT id, lineup_id FROM cash_rule")).toEqual([
				["existing-rule", "existing-lineup"],
			]);
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
		} finally {
			db.close();
		}
	});
});
