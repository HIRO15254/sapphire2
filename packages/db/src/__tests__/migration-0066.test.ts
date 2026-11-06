import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
} from "./sqlite";

const RULES_EMPTY_GATE =
	/NOT NULL constraint failed: __gate_0066\.rules_empty/u;

const target = "0066_tournament_final.sql";
const beforeEntry = migrationFiles("0061_").map(statementsOf);
const cutovers = migrationFiles(target)
	.filter((name) => name >= "0061_")
	.map(statementsOf);
const targetStatements = statementsOf(target);
const directory = mkdtempSync(join(tmpdir(), "sapphire2-migration-0066-"));
const seededPath = join(directory, "seeded.sqlite");
let index = 0;

const seed = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES
 ('a-room', 'alice', 'Club', 2), ('b-room', 'bob', 'Bar', 2);
INSERT INTO asset (id, user_id, name, updated_at) VALUES
 ('a-asset', 'alice', 'Chips', 2), ('b-asset', 'bob', 'Unassigned', 2);
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, created_at, updated_at) VALUES
 ('big', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', 1, 2),
 ('stud', 'alice', NULL, 'Stud', 'Ante', NULL, 1, 2),
 ('b-big', 'bob', 'bigbet', 'Big Bet', 'SB', 'BB', 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, group_id, sort_order, created_at, updated_at) VALUES
 ('nlh', 'alice', 'nlh', 'Holdem', 'big', 0, 1, 2),
 ('razz', 'alice', 'razz', 'Razz', 'stud', 0, 1, 2),
 ('b-nlh', 'bob', 'nlh', 'Holdem', 'b-big', 0, 1, 2);
INSERT INTO game_mix (id, user_id, builtin_key, label, games, created_at, updated_at) VALUES
 ('rotation', 'alice', 'horse', 'Rotation', '["nlh","razz"]', 1, 2);
INSERT INTO tournament (id, user_id, room_id, name, variant, buy_in, entry_fee, starting_stack, bounty_amount, table_size, currency_id, memo, house_rules, created_at, updated_at) VALUES
 ('main', 'alice', 'a-room', 'Main', 'horse', 1000, 100, 5000, 50, 9, 'a-asset', 'memo', 'rules', 10, 20),
 ('unknown-mix', 'alice', 'a-room', 'Unknown mix', 'Mystery rotation', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 20),
 ('unknown-variant', 'bob', 'b-room', 'Unknown variant', 'Mystery game', 25, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 20);
INSERT INTO blind_level (id, tournament_id, level, is_break, blind1, blind2, blind3, ante, minutes, games) VALUES
 ('equal', 'main', 1, 0, 999, 998, 997, 996, 20, '[{"name":"Big Bet 1","variants":["nlh"],"blind1":10,"blind2":20,"ante":2},{"name":"Stud","variants":["razz"],"blind1":30,"blind2":60,"ante":3}]'),
 ('different', 'main', 2, 0, 999, 998, NULL, NULL, 0, '[{"name":"Custom","variants":["razz"],"blind1":40,"blind2":80}]'),
 ('flat', 'main', 3, 0, 100, 200, -1, 25, 15, NULL),
 ('break', 'main', 4, 1, 777, 888, NULL, NULL, 10, NULL),
 ('not-array', 'main', 5, 0, 5, 10, NULL, NULL, 10, '{"variants":["nlh"]}'),
 ('bad-elements', 'main', 6, 0, 9, 18, NULL, NULL, 10, '[42,{"variants":"nlh"},{"variants":[null,42," ","nlh"],"blind1":"12","blind2":1.5,"blind3":-2,"ante":4}]'),
 ('bad-json', 'main', 7, 0, 7, 14, NULL, NULL, 10, 'not json'),
 ('unknown-level', 'unknown-mix', 1, 0, NULL, NULL, NULL, NULL, 10, '[{"variants":["razz"," New Stud "],"blind1":3}]');
INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips, sort_order) VALUES
 ('addon-b', 'main', 'Second', 200, 1000, 2), ('addon-a', 'main', 'First', 50, 500, 1),
 ('bob-addon', 'unknown-variant', 'Bonus', 10, 100, 0);
INSERT INTO tournament_tag (id, tournament_id, name, created_at) VALUES ('tag', 'main', 'Turbo', 3);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, created_at, updated_at) VALUES
 ('session', 'alice', 'tournament', 'manual', 'completed', 1791417600, 1, 2);
INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee) VALUES ('session', 'main', 1000, 100);
`;

function apply(db: Database, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

function references(db: Database) {
	return [
		"SELECT * FROM blind_level ORDER BY id",
		"SELECT * FROM tournament_chip_purchase ORDER BY id",
		"SELECT * FROM tournament_tag ORDER BY id",
		"SELECT session_id, tournament_id FROM session_tournament_detail ORDER BY session_id",
		"SELECT entry_id, user_id, tournament_id FROM entry_tournament ORDER BY entry_id",
	].map((sql) => values(db, sql));
}

describe("migration 0066 — tournament rule cutover", () => {
	let db: Database;
	beforeAll(() => {
		const source = openDatabase();
		try {
			source.exec("PRAGMA foreign_keys=ON");
			for (const statements of beforeEntry) {
				apply(source, statements);
			}
			source.exec(seed);
			for (const statements of cutovers) {
				apply(source, statements);
			}
			source.prepare("VACUUM INTO ?").run(seededPath);
		} finally {
			source.close();
		}
	});
	afterAll(() => rmSync(directory, { force: true, recursive: true }));
	beforeEach(() => {
		const path = join(directory, `${index++}.sqlite`);
		copyFileSync(seededPath, path);
		db = openDatabase(path);
		db.exec(
			"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
		);
	});
	afterEach(() => db?.close());

	it("guards malformed nested games and retains only valid labels and integer blinds", () => {
		apply(db);
		expect(
			values(
				db,
				`SELECT id, lineup_id, inherits_lineup, inherited_lineup_id FROM tournament_rule_level WHERE id IN ('trl:not-array','trl:bad-json','trl:bad-elements') ORDER BY id`
			)
		).toEqual([
			["trl:bad-elements", "lu:trl:bad-elements", 0, null],
			["trl:bad-json", "lu:tr:main", 1, "lu:tr:main"],
			["trl:not-array", "lu:tr:main", 1, "lu:tr:main"],
		]);
		expect(
			values(
				db,
				`SELECT v.variant_id FROM game_lineup_variant v WHERE v.lineup_id = 'lu:trl:bad-elements'`
			)
		).toEqual([["nlh"]]);
		expect(
			values(
				db,
				`SELECT blind1, blind2, blind3, ante, ante_type FROM tournament_rule_level_stake WHERE level_id = 'trl:bad-elements'`
			)
		).toEqual([[null, null, null, 4, null]]);
	});

	it("resolves builtin keys and preserves unknown names as archived stand-ins in the sibling or fallback group", () => {
		apply(db);
		expect(
			values(db, `SELECT game_mix_id FROM game_lineup WHERE id = 'lu:tr:main'`)
		).toEqual([["rotation"]]);
		expect(
			values(
				db,
				`SELECT variant_id FROM game_lineup_variant WHERE lineup_id = 'lu:tr:main' ORDER BY lineup_group_id, position`
			)
		).toEqual([["nlh"], ["razz"]]);
		expect(
			values(
				db,
				`SELECT id, label, group_id, archived_at IS NOT NULL FROM game_variant WHERE id LIKE 'sv:%' ORDER BY id`
			)
		).toEqual([
			["sv:alice:new stud", "New Stud", "stud", 1],
			["sv:bob:mystery game", "Mystery game", "b-big", 1],
		]);
		expect(
			values(
				db,
				`SELECT id, label, archived_at IS NOT NULL, games FROM game_mix WHERE id = 'sm:alice:mystery rotation'`
			)
		).toEqual([["sm:alice:mystery rotation", "Mystery rotation", 1, "[]"]]);
		expect(
			values(
				db,
				`SELECT variant_id, position FROM game_mix_variant WHERE mix_id = 'sm:alice:mystery rotation' ORDER BY position`
			)
		).toEqual([
			["razz", 0],
			["sv:alice:new stud", 1],
		]);
	});

	it("inherits equal compositions and creates an override with a null mirror for different games", () => {
		apply(db);
		expect(
			values(
				db,
				`SELECT id, ordinal, level, minutes, lineup_id, inherits_lineup, inherited_lineup_id FROM tournament_rule_level WHERE id IN ('trl:equal','trl:different') ORDER BY ordinal`
			)
		).toEqual([
			["trl:equal", 1, 1, 20, "lu:tr:main", 1, "lu:tr:main"],
			["trl:different", 2, 2, null, "lu:trl:different", 0, null],
		]);
		expect(
			values(
				db,
				`SELECT g.position, g.game_group_id, g.name, v.variant_id FROM game_lineup_group g JOIN game_lineup_variant v ON v.lineup_group_id = g.id WHERE g.lineup_id = 'lu:trl:different' ORDER BY g.position, v.position`
			)
		).toEqual([[0, "stud", "Custom", "razz"]]);
	});

	it("copies flat stakes to every inherited group, discards hidden values, and excludes breaks", () => {
		apply(db);
		expect(
			values(
				db,
				`SELECT s.level_id, g.position, s.blind1, s.blind2, s.blind3, s.ante, s.ante_type FROM tournament_rule_level_stake s JOIN game_lineup_group g ON g.id = s.lineup_group_id WHERE s.level_id IN ('trl:equal','trl:flat','trl:break') ORDER BY s.level_id, g.position`
			)
		).toEqual([
			["trl:equal", 0, 10, 20, null, 2, null],
			["trl:equal", 1, 30, 60, null, 3, null],
			["trl:flat", 0, 100, 200, null, 25, null],
			["trl:flat", 1, 100, 200, null, 25, null],
		]);
	});

	it("backfills entry and ordered addon prices with owned or unassigned assets", () => {
		apply(db);
		expect(
			values(
				db,
				"SELECT id, kind, label, asset_id, amount, fee, chips, ordinal FROM tournament_rule_price ORDER BY rule_id, ordinal"
			)
		).toEqual([
			["trp:tr:main:entry", "entry", "", "a-asset", 1000, 100, null, 1],
			["trp:addon-a", "addon", "First", "a-asset", 50, 0, 500, 2],
			["trp:addon-b", "addon", "Second", "a-asset", 200, 0, 1000, 3],
			[
				"trp:tr:unknown-variant:entry",
				"entry",
				"",
				"unassigned:bob",
				25,
				0,
				null,
				1,
			],
			["trp:bob-addon", "addon", "Bonus", "unassigned:bob", 10, 0, 100, 2],
		]);
		expect(
			values(
				db,
				`SELECT user_id, name, kind, decimals FROM asset WHERE id = 'unassigned:bob'`
			)
		).toEqual([["bob", "Unassigned (migrated)", "currency", 0]]);
		expect(
			values(
				db,
				"SELECT id, default_asset_id, current_rule_id, memo FROM tournament ORDER BY id"
			)
		).toEqual([
			["main", "a-asset", "tr:main", "memo"],
			["unknown-mix", null, "tr:unknown-mix", null],
			["unknown-variant", null, "tr:unknown-variant", null],
		]);
	});

	it("restores all staged rows and links and permits account deletion with foreign keys enabled", () => {
		const before = references(db);
		expect(before.map((rows) => rows.length)).toEqual([8, 3, 1, 1, 1]);
		expect(before[4]).toEqual([["session", "alice", "main"]]);
		apply(db);
		expect(references(db)).toEqual(before);
		expect(values(db, "PRAGMA foreign_keys")).toEqual([[1]]);
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
		expect(
			values(
				db,
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_\\_%' ESCAPE '\\'"
			)
		).toEqual([]);
		expect(() => db.exec("DELETE FROM user WHERE id = 'alice'")).not.toThrow();
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
	});

	it("aborts before rebuilding when tournament rules already exist", () => {
		db.exec(`INSERT INTO game_lineup (id, user_id) VALUES ('existing-lineup', 'alice');
   INSERT INTO tournament_rule (id, user_id, lineup_id) VALUES ('existing-rule', 'alice', 'existing-lineup');`);
		expect(() => apply(db)).toThrow(RULES_EMPTY_GATE);
		expect(values(db, "SELECT id FROM tournament ORDER BY id")).toEqual([
			["main"],
			["unknown-mix"],
			["unknown-variant"],
		]);
	});
});
