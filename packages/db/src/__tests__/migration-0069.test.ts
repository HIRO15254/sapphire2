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

const TARGET = "0069_entry_rule_versions.sql";
const PRECONDITION_GATE =
	/NOT NULL constraint failed: __gate_0069\.precondition/u;
const BIG_BET_GATE = /NOT NULL constraint failed: __gate_0069\.big_bet_blind3/u;
const RULE_ID_REQUIRED =
	/NOT NULL constraint failed: entry_cash\.cash_rule_id/u;
const FOREIGN_KEY_FAILED = /FOREIGN KEY constraint failed/u;
const PRICES_GATE = /NOT NULL constraint failed: __gate_0069\.prices/u;
const beforeEntry = migrationFiles("0061_").map(statementsOf);
const cutovers = migrationFiles(TARGET)
	.filter((name) => name >= "0061_")
	.map(statementsOf);
const targetStatements = statementsOf(TARGET);
const directory = mkdtempSync(join(tmpdir(), "sapphire2-migration-0069-"));
const seededPath = join(directory, "seeded.sqlite");
let index = 0;

const day = Date.parse("2026-10-08T00:00:00Z") / 1000;
const live = day + 10 * 3600;

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES ('room', 'alice', 'Club', 2);
INSERT INTO asset (id, user_id, name, updated_at) VALUES ('jpy', 'alice', 'JPY', 2);
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, created_at, updated_at) VALUES
 ('big', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', 1, 2),
 ('stud', 'alice', 'stud', 'Stud', 'Small Bet', 'Big Bet', 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, group_id, sort_order, created_at, updated_at) VALUES
 ('nlh', 'alice', 'nlh', 'NL Hold''em', 'big', 0, 1, 2),
 ('razz', 'alice', 'razz', 'Razz', 'stud', 1, 1, 2);
INSERT INTO ring_game (id, room_id, user_id, name, variant, blind1, blind2, min_buy_in, max_buy_in, table_size, currency_id, house_rules, created_at, updated_at) VALUES
 ('ring', 'room', 'alice', 'Ring', 'NL Hold''em', 1, 2, 100, 500, 9, 'jpy', 'rules', 1, 2);
INSERT INTO tournament (id, user_id, room_id, name, variant, buy_in, entry_fee, starting_stack, table_size, currency_id, house_rules, created_at, updated_at) VALUES
 ('mtt', 'alice', 'room', 'Main', 'NL Hold''em', 1000, 100, 5000, 9, 'jpy', 'rules', 1, 2);
INSERT INTO blind_level (id, tournament_id, level, is_break, blind1, blind2, minutes) VALUES
 ('m1', 'mtt', 1, 0, 100, 200, 20), ('m2', 'mtt', 2, 1, NULL, NULL, 10);
INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips, sort_order) VALUES
 ('m-addon', 'mtt', 'Add-on', 500, 5000, 0);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, currency_id, created_at, updated_at) VALUES
 ('c-equal', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 1, 2),
 ('c-diff-a', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 3, 4),
 ('c-diff-b', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 4, 5),
 ('c-free', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 5, 6),
 ('c-bad', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 6, 7),
 ('c-bob', 'bob', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, NULL, 7, 8),
 ('t-equal', 'alice', 'tournament', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 1, 2),
 ('t-diff', 'alice', 'tournament', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 3, 4),
 ('t-diff2', 'alice', 'tournament', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 4, 5),
 ('t-levels', 'alice', 'tournament', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 8, 9),
 ('t-free', 'alice', 'tournament', 'manual', 'completed', ${day}, NULL, NULL, 0, 'jpy', 5, 6),
 ('t-live', 'alice', 'tournament', 'live', 'completed', ${day}, ${live}, ${live + 120}, 0, 'jpy', 6, 7);
INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in, cash_out, variant, mix_games, blind1, blind2, min_buy_in, max_buy_in, table_size, house_rules) VALUES
 ('c-equal', 'ring', 100, 150, 'NL Hold''em', NULL, 1, 2, 100, 500, 9, ' rules' || char(13) || char(10)),
 ('c-diff-a', 'ring', 100, 50, 'NL Hold''em', NULL, 2, 4, 100, 500, 9, 'rules'),
 ('c-diff-b', 'ring', 100, 50, 'NL Hold''em', NULL, 2, 4, 100, 500, 9, 'rules'),
 ('c-free', NULL, 100, 50, 'Razz', NULL, 5, 10, NULL, NULL, NULL, NULL),
 ('c-bad', NULL, 100, 50, 'mix', 'not json', 5, 10, NULL, NULL, NULL, NULL),
 ('c-bob', NULL, 10, 0, 'NL Hold''em', NULL, 1, 3, NULL, NULL, NULL, NULL);
INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee, placement, total_entries, prize_money, variant, starting_stack, table_size, house_rules) VALUES
 ('t-equal', 'mtt', 1000, 100, 1, 10, 5000, 'NL Hold''em', 5000, 9, 'rules'),
 ('t-diff', 'mtt', 1000, 100, 2, 10, 0, 'NL Hold''em', 5000, 9, 'rules'),
 ('t-diff2', 'mtt', 1000, 100, 3, 10, 0, 'NL Hold''em', 5000, 9, 'rules'),
 ('t-levels', 'mtt', 1000, 100, 5, 10, 0, 'NL Hold''em', 5000, 9, 'rules'),
 ('t-free', NULL, 200, NULL, NULL, NULL, NULL, 'Razz', NULL, NULL, NULL),
 ('t-live', 'mtt', 1000, 100, 4, 10, 0, 'NL Hold''em', 5000, 9, 'rules');
INSERT INTO session_blind_level (id, session_id, level, is_break, blind1, blind2, minutes) VALUES
 ('te1', 't-equal', 1, 0, 100, 200, 20), ('te2', 't-equal', 2, 1, NULL, NULL, 10),
 ('td1', 't-diff', 1, 0, 100, 200, 20), ('td2', 't-diff', 2, 1, NULL, NULL, 10),
 ('tf1', 't-diff2', 1, 0, 100, 200, 20), ('tf2', 't-diff2', 2, 1, NULL, NULL, 10),
 ('tl1', 't-live', 1, 0, 100, 200, 20), ('tl2', 't-live', 2, 1, NULL, NULL, 10);
INSERT INTO session_blind_level (id, session_id, level, is_break, blind1, blind2, minutes, games) VALUES
 ('tv1', 't-levels', 1, 0, 999, 999, 30, '[{"variants":["Razz"],"blind1":3,"blind2":6}]'),
 ('tv2', 't-levels', 2, 0, 100, 200, 20, 'not json');
INSERT INTO session_chip_purchase (id, session_id, name, cost, chips, sort_order) VALUES
 ('te-addon', 't-equal', 'Add-on', 500, 5000, 0),
 ('td-addon', 't-diff', 'Add-on', 500, 5000, 1), ('td-rebuy', 't-diff', 'Rebuy', 300, 1000, 0),
 ('tf-addon', 't-diff2', 'Add-on', 500, 5000, 1), ('tf-rebuy', 't-diff2', 'Rebuy', 300, 1000, 0),
 ('tl-addon', 't-live', 'Add-on', 500, 5000, 0);
INSERT INTO session_chip_purchase_result (session_chip_purchase_id, count) VALUES
 ('te-addon', 2), ('td-addon', 1), ('td-rebuy', 2), ('tf-addon', 1), ('tf-rebuy', 1), ('tl-addon', 1);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('live-start', 't-live', 'session_start', ${live}, 0, '{"timerStartedAt":null}', 1, 2),
 ('live-addon', 't-live', 'purchase_chips', ${live + 60}, 1, '{"sessionChipPurchaseId":"tl-addon","name":"Add-on","cost":500,"chips":5000}', 1, 2),
 ('live-end', 't-live', 'session_end', ${live + 120}, 2, '{"beforeDeadline":false,"placement":4,"totalEntries":10,"prizeMoney":0,"bountyPrizes":0}', 1, 2);
`;

const LEDGER =
	"SELECT id, user_id, asset_id, quantity, role, effect, entry_id, play_session_id, source_event_id, category_id, transfer_id, occurred_at, memo, created_at, updated_at FROM ledger_line ORDER BY id";

function apply(db: Database, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

describe("migration 0069 — entry rule versions", () => {
	let db: Database;
	beforeAll(() => {
		const source = openDatabase();
		try {
			source.exec("PRAGMA foreign_keys=ON");
			for (const statements of beforeEntry) {
				apply(source, statements);
			}
			source.exec(SEED);
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
		const path = join(directory, `${index}.sqlite`);
		index += 1;
		copyFileSync(seededPath, path);
		db = openDatabase(path);
		db.exec(
			"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
		);
	});
	afterEach(() => db?.close());

	it("shares equal snapshots, branches differing ones and keeps unlinked entries standalone", () => {
		apply(db);
		expect(
			values(
				db,
				"SELECT e.entry_id, e.cash_rule_id, r.ring_game_id, r.parent_rule_id, r.lineup_id FROM entry_cash e JOIN cash_rule r ON r.id = e.cash_rule_id ORDER BY e.entry_id"
			)
		).toEqual([
			["c-bad", "cr:e:c-bad", null, null, "lu:cr:e:c-bad"],
			["c-bob", "cr:e:c-bob", null, null, "lu:cr:e:c-bob"],
			["c-diff-a", "cr:e:c-diff-a", "ring", "cr:ring", "lu:cr:ring"],
			["c-diff-b", "cr:e:c-diff-a", "ring", "cr:ring", "lu:cr:ring"],
			["c-equal", "cr:ring", "ring", null, "lu:cr:ring"],
			["c-free", "cr:e:c-free", null, null, "lu:cr:e:c-free"],
		]);
		expect(
			values(
				db,
				"SELECT r.id, s.blind1, s.blind2, r.house_rules FROM cash_rule r JOIN cash_rule_stake s ON s.rule_id = r.id WHERE r.id IN ('cr:e:c-diff-a', 'cr:e:c-free') ORDER BY r.id"
			)
		).toEqual([
			["cr:e:c-diff-a", 2, 4, "rules"],
			["cr:e:c-free", 5, 10, null],
		]);
		expect(
			values(
				db,
				"SELECT l.lineup_id, l.variant_id FROM game_lineup_variant l WHERE l.lineup_id IN ('lu:cr:e:c-free', 'lu:cr:e:c-bad', 'lu:cr:e:c-bob') ORDER BY l.lineup_id"
			)
		).toEqual([
			["lu:cr:e:c-bad", "sv:alice:mixed game"],
			["lu:cr:e:c-bob", "bob:builtin-variant:nlh"],
			["lu:cr:e:c-free", "razz"],
		]);
		expect(
			values(
				db,
				"SELECT e.entry_id, e.tournament_rule_id, r.tournament_id, r.parent_rule_id, r.lineup_id FROM entry_tournament e JOIN tournament_rule r ON r.id = e.tournament_rule_id ORDER BY e.entry_id"
			)
		).toEqual([
			["t-diff", "tr:e:t-diff", "mtt", "tr:mtt", "lu:tr:mtt"],
			["t-diff2", "tr:e:t-diff", "mtt", "tr:mtt", "lu:tr:mtt"],
			["t-equal", "tr:mtt", "mtt", null, "lu:tr:mtt"],
			["t-free", "tr:e:t-free", null, null, "lu:tr:e:t-free"],
			["t-levels", "tr:e:t-levels", "mtt", "tr:mtt", "lu:tr:mtt"],
			["t-live", "tr:mtt", "mtt", null, "lu:tr:mtt"],
		]);
		expect(
			values(
				db,
				"SELECT id, ordinal, level, is_break, minutes, lineup_id, inherits_lineup FROM tournament_rule_level WHERE rule_id = 'tr:e:t-diff' ORDER BY ordinal"
			)
		).toEqual([
			["trl:e:td1", 1, 1, 0, 20, "lu:tr:mtt", 1],
			["trl:e:td2", 2, 2, 1, 10, "lu:tr:mtt", 1],
		]);
		expect(
			values(
				db,
				"SELECT l.id, l.lineup_id, l.inherits_lineup, s.blind1, s.blind2, (SELECT group_concat(v.variant_id) FROM game_lineup_variant v WHERE v.lineup_id = l.lineup_id) FROM tournament_rule_level l JOIN tournament_rule_level_stake s ON s.level_id = l.id WHERE l.rule_id = 'tr:e:t-levels' ORDER BY l.ordinal"
			)
		).toEqual([
			["trl:e:tv1", "lu:trl:e:tv1", 0, 3, 6, "razz"],
			["trl:e:tv2", "lu:tr:mtt", 1, 100, 200, "nlh"],
		]);
		expect(
			values(
				db,
				"SELECT id, kind, label, asset_id, amount, fee, chips, ordinal FROM tournament_rule_price WHERE rule_id IN ('tr:e:t-diff', 'tr:e:t-free') ORDER BY rule_id, ordinal"
			)
		).toEqual([
			["trp:tr:e:t-diff:entry", "entry", "", "jpy", 1000, 100, null, 1],
			["trp:e:td-rebuy", "addon", "Rebuy", "jpy", 300, 0, 1000, 2],
			["trp:e:td-addon", "addon", "Add-on", "jpy", 500, 0, 5000, 3],
			["trp:tr:e:t-free:entry", "entry", "", "jpy", 200, 0, null, 1],
		]);
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
	});

	it("prices tournament lines from the entry's version without changing ledger amounts", () => {
		const before = values(db, LEDGER);
		apply(db);
		expect(values(db, LEDGER)).toEqual(before);
		expect(
			values(
				db,
				"SELECT id, role, -quantity, price_id FROM ledger_line WHERE price_id IS NOT NULL OR role IN ('buy_in', 'fee', 'chip_purchase') AND entry_id LIKE 't-%' ORDER BY id"
			)
		).toEqual([
			["live-addon:0", "chip_purchase", 500, "trp:m-addon"],
			["live-start:0", "buy_in", 1000, "trp:tr:mtt:entry"],
			["live-start:1", "fee", 100, "trp:tr:mtt:entry"],
			["m:t-diff2:buy_in:0", "buy_in", 1000, "trp:tr:e:t-diff:entry"],
			["m:t-diff2:chip_purchase:0", "chip_purchase", 300, "trp:e:td-rebuy"],
			["m:t-diff2:chip_purchase:1", "chip_purchase", 500, "trp:e:td-addon"],
			["m:t-diff2:fee:0", "fee", 100, "trp:tr:e:t-diff:entry"],
			["m:t-diff:buy_in:0", "buy_in", 1000, "trp:tr:e:t-diff:entry"],
			["m:t-diff:chip_purchase:0", "chip_purchase", 300, "trp:e:td-rebuy"],
			["m:t-diff:chip_purchase:1", "chip_purchase", 300, "trp:e:td-rebuy"],
			["m:t-diff:chip_purchase:2", "chip_purchase", 500, "trp:e:td-addon"],
			["m:t-diff:fee:0", "fee", 100, "trp:tr:e:t-diff:entry"],
			["m:t-equal:buy_in:0", "buy_in", 1000, "trp:tr:mtt:entry"],
			["m:t-equal:chip_purchase:0", "chip_purchase", 500, "trp:m-addon"],
			["m:t-equal:chip_purchase:1", "chip_purchase", 500, "trp:m-addon"],
			["m:t-equal:fee:0", "fee", 100, "trp:tr:mtt:entry"],
			["m:t-free:buy_in:0", "buy_in", 200, "trp:tr:e:t-free:entry"],
			["m:t-levels:buy_in:0", "buy_in", 1000, "trp:tr:e:t-levels:entry"],
			["m:t-levels:fee:0", "fee", 100, "trp:tr:e:t-levels:entry"],
		]);
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
	});

	it("stops when an entry snapshot carries a Big Bet blind3", () => {
		db.exec(
			"UPDATE session_cash_detail SET blind3 = 4 WHERE session_id = 'c-diff-a'"
		);
		expect(() => apply(db)).toThrow(BIG_BET_GATE);
	});

	it("prices a live purchase event without a purchase id by its unique name, cost and chips", () => {
		db.exec(
			`UPDATE play_event SET payload = '{"name":"Add-on","cost":500,"chips":5000}' WHERE id = 'live-addon'`
		);
		apply(db);
		expect(
			values(db, "SELECT price_id FROM ledger_line WHERE id = 'live-addon:0'")
		).toEqual([["trp:m-addon"]]);
	});

	it("stops when a live purchase event names a purchase that no longer exists", () => {
		db.exec(
			`UPDATE play_event SET payload = '{"sessionChipPurchaseId":"gone","name":"Add-on","cost":500,"chips":5000}' WHERE id = 'live-addon'`
		);
		expect(() => apply(db)).toThrow(PRICES_GATE);
	});

	it("rebuilds the details so a rule id is required", () => {
		apply(db);
		db.exec(
			"INSERT INTO entry (id, user_id, kind, source, status, played_on, updated_at) VALUES ('new', 'alice', 'cash', 'manual', 'settled', '2026-10-09', 2)"
		);
		expect(() =>
			db.exec(
				"INSERT INTO entry_cash (entry_id, user_id, kind) VALUES ('new', 'alice', 'cash')"
			)
		).toThrow(RULE_ID_REQUIRED);
		expect(() =>
			db.exec(
				"INSERT INTO entry_cash (entry_id, user_id, kind, ring_game_id, cash_rule_id) VALUES ('new', 'alice', 'cash', 'ring', 'cr:e:c-free')"
			)
		).toThrow(FOREIGN_KEY_FAILED);
	});

	it("aborts before writing when an entry already has a rule version", () => {
		db.exec(
			"INSERT INTO game_lineup (id, user_id) VALUES ('pre', 'alice'); INSERT INTO cash_rule (id, user_id, lineup_id) VALUES ('pre', 'alice', 'pre'); UPDATE entry_cash SET cash_rule_id = 'pre' WHERE entry_id = 'c-free'"
		);
		expect(() => apply(db)).toThrow(PRECONDITION_GATE);
		expect(
			values(db, "SELECT count(*) FROM cash_rule WHERE id LIKE 'cr:e:%'")
		).toEqual([[0]]);
	});
});
