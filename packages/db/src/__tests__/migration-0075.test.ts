import { describe, expect, it } from "vitest";
import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
	stringValue,
} from "./sqlite";

const TARGET = "0075_retire_legacy_schema.sql";
const FIRST_UNRELEASED = "0054_";
const day = Date.parse("2026-10-08T00:00:00Z") / 1000;

const LEGACY_SEED = `
INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES ('club', 'alice', 'Club', 2);
INSERT INTO currency (id, user_id, name, updated_at) VALUES ('chips', 'alice', 'Chips', 2);
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, created_at, updated_at) VALUES
 ('group', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at) VALUES
 ('nlh', 'alice', 'nlh', 'NL Hold''em', 'NLH', 'group', 0, 1, 2),
 ('plo', 'alice', 'plo', 'PL Omaha', 'PLO', 'group', 1, 1, 2);
INSERT INTO game_mix (id, user_id, label, games, created_at, updated_at) VALUES
 ('mix', 'alice', 'Rotation', '["plo","nlh"]', 1, 2);
INSERT INTO ring_game (id, user_id, room_id, currency_id, name, variant, blind1, blind2, created_at, updated_at) VALUES
 ('ring', 'alice', 'club', 'chips', 'Cash', 'NL Hold''em', 1, 2, 1, 2);
INSERT INTO tournament (id, room_id, currency_id, name, variant, buy_in, entry_fee, starting_stack, table_size, created_at, updated_at) VALUES
 ('mtt', 'club', 'chips', 'Daily', 'NL Hold''em', 1000, 100, 5000, 9, 1, 2);
INSERT INTO blind_level (id, tournament_id, level, is_break, blind1, blind2, minutes) VALUES
 ('level', 'mtt', 1, 0, 25, 50, 20);
INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips, sort_order) VALUES
 ('addon', 'mtt', 'Add-on', 500, 5000, 0);
INSERT INTO tournament_tag (id, tournament_id, name, created_at) VALUES ('tt', 'mtt', 'Turbo', 3);
INSERT INTO player (id, user_id, name, created_at, updated_at) VALUES ('player', 'alice', 'Opponent', 1, 2);
INSERT INTO player_tag (id, user_id, name, color, created_at, updated_at) VALUES ('pt', 'alice', 'Loose', 'red', 1, 2);
INSERT INTO player_to_player_tag (player_id, player_tag_id, position) VALUES ('player', 'pt', 0);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, break_minutes, room_id, currency_id, created_at, updated_at) VALUES
 ('cash', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, 'club', 'chips', 1, 2),
 ('roomless', 'alice', 'cash_game', 'manual', 'completed', ${day}, 0, NULL, NULL, 1, 2),
 ('tournament-entry', 'alice', 'tournament', 'manual', 'completed', ${day}, 0, 'club', 'chips', 1, 2),
 ('live', 'alice', 'cash_game', 'live', 'completed', ${day}, 0, 'club', 'chips', 1, 2);
UPDATE game_session SET started_at = ${day + 3600}, ended_at = ${day + 4200} WHERE id = 'live';
INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in, cash_out, variant, blind1, blind2) VALUES
 ('cash', 'ring', 100, 150, 'NL Hold''em', 1, 2),
 ('roomless', NULL, 100, 50, 'NL Hold''em', 1, 2),
 ('live', 'ring', 100, 150, 'NL Hold''em', 1, 2);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('live-start', 'live', 'session_start', ${day + 3600}, 0, '{"buyInAmount":100}', 1, 2),
 ('live-end', 'live', 'session_end', ${day + 4200}, 1, '{"cashOutAmount":150}', 1, 2);
INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee, placement, total_entries, prize_money) VALUES
 ('tournament-entry', 'mtt', 1000, 100, 2, 10, 2000);
INSERT INTO session_tag (id, user_id, name, created_at) VALUES ('st', 'alice', 'Live', 1);
INSERT INTO session_to_session_tag (session_id, session_tag_id) VALUES ('cash', 'st');
INSERT INTO transaction_type (id, user_id, name, updated_at) VALUES ('type', 'alice', 'Adjustment', 1);
INSERT INTO currency_transaction (id, currency_id, transaction_type_id, session_id, amount, transacted_at, created_at) VALUES
 ('deposit', 'chips', 'type', NULL, 100, ${day}, 2);
INSERT INTO todo (text) VALUES ('legacy production row');
`;

const RETIRED = [
	"session_chip_purchase_result",
	"session_chip_purchase",
	"session_blind_level",
	"session_to_session_tag",
	"currency_transaction",
	"session_cash_detail",
	"session_tournament_detail",
	"session_event",
	"game_session",
	"session_tag",
	"transaction_type",
	"player_to_player_tag",
	"blind_level",
	"tournament_chip_purchase",
	"todo",
] as const;

const FINAL_TABLES = [
	"user",
	"account",
	"session",
	"verification",
	"passkey",
	"oauth_application",
	"oauth_access_token",
	"oauth_consent",
	"update_note_view",
	"asset",
	"asset_rate",
	"user_setting",
	"ledger_category",
	"ledger_line",
	"room",
	"ring_game",
	"tournament",
	"game_group",
	"game_variant",
	"game_mix",
	"game_mix_variant",
	"game_lineup",
	"game_lineup_group",
	"game_lineup_variant",
	"cash_rule",
	"cash_rule_stake",
	"tournament_rule",
	"tournament_rule_level",
	"tournament_rule_level_stake",
	"tournament_rule_price",
	"entry",
	"entry_cash",
	"entry_tournament",
	"play_session",
	"play_event",
	"hand",
	"hand_seat",
	"hand_action",
	"hand_board",
	"player",
	"filter_preset",
	"entry_tag",
	"entry_tag_link",
	"tournament_tag",
	"tournament_tag_link",
	"hand_tag",
	"hand_tag_link",
	"player_tag",
	"player_tag_link",
].toSorted();

function apply(db: Database, file: string): void {
	for (const statement of statementsOf(file)) {
		db.exec(statement);
	}
}

function beforeTarget(): Database {
	const db = openDatabase();
	try {
		db.exec("PRAGMA foreign_keys=ON");
		for (const file of migrationFiles(FIRST_UNRELEASED)) {
			apply(db, file);
		}
		db.exec(LEGACY_SEED);
		for (const file of migrationFiles(TARGET).filter(
			(name) => name >= FIRST_UNRELEASED
		)) {
			apply(db, file);
		}
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

function tableNames(db: Database): string[] {
	return values(
		db,
		"SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name"
	).map(([name]) => stringValue(name));
}

function rows(db: Database, table: string) {
	const columns = values(db, `PRAGMA table_info("${table}")`)
		.map((row) => stringValue(row[1]))
		.filter((name) => table !== "game_mix" || name !== "games")
		.map((name) => `"${name}"`)
		.join(", ");
	return values(db, `SELECT ${columns} FROM "${table}" ORDER BY rowid`);
}

describe("migration 0075 — legacy schema retirement", () => {
	it("migrates production-shaped legacy data through every unpublished migration without losing final rows or links", () => {
		const db = beforeTarget();
		try {
			expect(values(db, "PRAGMA foreign_keys")).toEqual([[1]]);
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
			const before = tableNames(db).filter(
				(name) =>
					!RETIRED.includes(name as (typeof RETIRED)[number]) &&
					name !== "tournament_tag"
			);
			const preserved = new Map(before.map((name) => [name, rows(db, name)]));
			expect(
				values(db, "SELECT id, room_id FROM entry ORDER BY id")
			).toContainEqual(["roomless", null]);
			expect(
				values(
					db,
					"SELECT mix_id, variant_id, position FROM game_mix_variant ORDER BY position"
				)
			).toEqual([
				["mix", "plo", 0],
				["mix", "nlh", 1],
			]);
			expect(
				values(db, "SELECT tournament_id FROM tournament_tag_link")
			).toEqual([["mtt"]]);
			expect(values(db, "SELECT player_id FROM player_tag_link")).toEqual([
				["player"],
			]);
			expect(values(db, "SELECT entry_id FROM entry_tag_link")).toEqual([
				["cash"],
			]);
			expect(values(db, "SELECT id FROM play_event ORDER BY id")).toEqual([
				["live-end"],
				["live-start"],
			]);
			expect(values(db, "SELECT id FROM ring_game WHERE id = 'ring'")).toEqual([
				["ring"],
			]);
			expect(
				values(db, "SELECT count(*) FROM tournament_rule_level")
			).not.toEqual([[0]]);
			expect(
				values(db, "SELECT count(*) FROM tournament_rule_price")
			).not.toEqual([[0]]);

			apply(db, TARGET);

			expect(tableNames(db)).toEqual(
				before
					.map((name) =>
						name === "tournament_tag_def" ? "tournament_tag" : name
					)
					.toSorted()
			);
			expect(tableNames(db)).toEqual(FINAL_TABLES);
			expect(
				values(
					db,
					"SELECT DISTINCT \"table\" FROM pragma_foreign_key_list('tournament_tag_link')"
				)
			).toContainEqual(["tournament_tag"]);
			for (const [name, expected] of preserved) {
				expect(
					rows(db, name === "tournament_tag_def" ? "tournament_tag" : name),
					name
				).toEqual(expected);
			}
			for (const [table, columns] of Object.entries({
				game_mix: ["games"],
				ring_game: [
					"variant",
					"mix_games",
					"blind1",
					"blind2",
					"blind3",
					"ante",
					"ante_type",
					"min_buy_in",
					"max_buy_in",
					"table_size",
					"house_rules",
				],
				tournament: [
					"variant",
					"buy_in",
					"entry_fee",
					"starting_stack",
					"bounty_amount",
					"table_size",
					"house_rules",
				],
			})) {
				const actual = values(db, `PRAGMA table_info("${table}")`).map(
					(row) => row[1]
				);
				for (const column of columns) {
					expect(actual).not.toContain(column);
				}
			}
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("fails the inventory gate when an unexpected table remains", () => {
		const db = beforeTarget();
		try {
			db.exec("CREATE TABLE unexpected_legacy_table (id INTEGER)");
			expect(() => apply(db, TARGET)).toThrow(
				"NOT NULL constraint failed: __gate_0075.inventory"
			);
		} finally {
			db.close();
		}
	});
});
