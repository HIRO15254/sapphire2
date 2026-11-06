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

const TARGET_MIGRATION = "0063_ledger_cutover.sql";
const ENTRY_CUTOVER = "0061_entry_p1_cutover.sql";
const beforeEntryCutover = migrationFiles(ENTRY_CUTOVER).map(statementsOf);
const cutoversBeforeTarget = migrationFiles(TARGET_MIGRATION)
	.filter((file) => file >= ENTRY_CUTOVER)
	.flatMap(statementsOf);
const targetStatements = statementsOf(TARGET_MIGRATION);
const gateIndex = targetStatements.findIndex((statement) =>
	statement.startsWith("CREATE TABLE `__gate_0063`")
);

const midnight = Date.parse("2026-10-08T00:00:00Z") / 1000;
const noon = midnight + 12 * 3600;
const live = midnight + 10 * 3600;

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO asset (id, user_id, name, updated_at) VALUES
 ('alice-jpy', 'alice', 'JPY', 2), ('bob-jpy', 'bob', 'JPY', 2), ('bob-named', 'bob', ' UNASSIGNED ', 2);
INSERT INTO transaction_type (id, user_id, name, created_at, updated_at) VALUES
 ('deposit', 'alice', 'Deposit', 1, 2),
 ('deposit-copy', 'alice', ' deposit ', 1, 3),
 ('a-withdraw', 'alice', 'WITHDRAW', 9, 2),
 ('z-withdraw', 'alice', 'Withdraw', 3, 4),
 ('alice-result', 'alice', 'Session Result', 1, 2),
 ('bob-deposit', 'bob', 'Deposit', 5, 6);
INSERT INTO game_session
 (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, currency_id, created_at, updated_at) VALUES
 ('manual-cash', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, 0, 'alice-jpy', 1, 2),
 ('manual-mtt', 'alice', 'tournament', 'manual', 'completed', ${midnight}, ${midnight + 3600}, ${midnight + 7200}, 0, NULL, 1, 2),
 ('manual-empty', 'alice', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, 0, NULL, 1, 2),
 ('live-cash', 'alice', 'cash_game', 'live', 'completed', ${midnight}, ${live}, ${live + 300}, 1, 'alice-jpy', 1, 2),
 ('live-mtt', 'alice', 'tournament', 'live', 'completed', ${midnight}, ${live}, ${live + 120}, 0, NULL, 1, 2),
 ('live-open', 'alice', 'cash_game', 'live', 'active', ${midnight}, ${live}, NULL, 0, 'alice-jpy', 1, 2),
 ('bob-manual', 'bob', 'cash_game', 'manual', 'completed', ${midnight}, NULL, NULL, 0, NULL, 1, 2);
INSERT INTO session_cash_detail (session_id, buy_in, cash_out, chip_remove_total) VALUES
 ('manual-cash', 100, 150, 30),
 ('manual-empty', 0, NULL, NULL),
 ('live-cash', 150, 200, 30),
 ('live-open', 300, NULL, NULL),
 ('bob-manual', 10, 0, NULL);
INSERT INTO session_tournament_detail
 (session_id, tournament_buy_in, entry_fee, placement, total_entries, prize_money, bounty_prizes) VALUES
 ('manual-mtt', 1000, 100, 1, 10, 5000, 0),
 ('live-mtt', 2000, 150, 2, 10, 0, 400);
INSERT INTO session_chip_purchase (id, session_id, name, cost, chips, sort_order) VALUES
 ('rebuy', 'manual-mtt', 'Rebuy', 300, 1000, 1),
 ('addon', 'manual-mtt', 'Add-on', 200, 1000, 0),
 ('free', 'manual-mtt', 'Free', 0, 1000, 2),
 ('unused', 'manual-mtt', 'Unused', 500, 1000, 3),
 ('live-rebuy', 'live-mtt', 'Rebuy', 500, 1000, 0);
INSERT INTO session_chip_purchase_result (session_chip_purchase_id, count) VALUES
 ('rebuy', 2), ('addon', 1), ('free', 4), ('unused', 0), ('live-rebuy', 1);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('cash-start', 'live-cash', 'session_start', ${live}, 0, '{"buyInAmount":100}', 1, 2),
 ('cash-add', 'live-cash', 'chips_add_remove', ${live + 60}, 1, '{"amount":50}', 1, 2),
 ('cash-remove', 'live-cash', 'chips_add_remove', ${live + 120}, 2, '{"amount":-30}', 1, 2),
 ('cash-pause', 'live-cash', 'session_pause', ${live + 180}, 3, '{}', 1, 2),
 ('cash-resume', 'live-cash', 'session_resume', ${live + 240}, 4, '{}', 1, 2),
 ('cash-end', 'live-cash', 'session_end', ${live + 300}, 5, '{"cashOutAmount":200}', 1, 2),
 ('mtt-start', 'live-mtt', 'session_start', ${live}, 0, '{"timerStartedAt":null}', 1, 2),
 ('mtt-rebuy', 'live-mtt', 'purchase_chips', ${live + 60}, 1, '{"sessionChipPurchaseId":"live-rebuy","name":"Rebuy","cost":500,"chips":1000}', 1, 2),
 ('mtt-end', 'live-mtt', 'session_end', ${live + 120}, 2, '{"beforeDeadline":false,"placement":2,"totalEntries":10,"prizeMoney":0,"bountyPrizes":400}', 1, 2),
 ('open-start', 'live-open', 'session_start', ${live}, 0, '{"buyInAmount":300}', 1, 2);
INSERT INTO currency_transaction (id, currency_id, transaction_type_id, session_id, amount, transacted_at, memo, created_at) VALUES
 ('w-deposit', 'alice-jpy', 'deposit-copy', NULL, 5000, ${midnight + 60}, 'cash in', 7),
 ('w-withdraw', 'alice-jpy', 'a-withdraw', NULL, -2000, ${midnight + 120}, NULL, 8),
 ('w-reserved', 'alice-jpy', 'alice-result', NULL, 700, ${midnight + 180}, NULL, 9),
 ('w-zero', 'alice-jpy', 'deposit', NULL, 0, ${midnight + 240}, NULL, 10),
 ('w-session', 'alice-jpy', 'alice-result', 'manual-cash', 80, ${midnight}, NULL, 11),
 ('w-foreign-type', 'bob-jpy', 'deposit', NULL, 300, ${midnight + 300}, NULL, 12);
`;

const LEGACY_TABLES = [
	"transaction_type",
	"currency_transaction",
	"session_cash_detail",
	"session_tournament_detail",
	"session_chip_purchase",
	"session_chip_purchase_result",
] as const;

const snapshotDirectory = mkdtempSync(
	join(tmpdir(), "sapphire2-migration-0063-")
);
const seededPath = join(snapshotDirectory, "seeded.sqlite");
let databaseIndex = 0;

function seededDatabase(): Database {
	const path = join(snapshotDirectory, `${databaseIndex}.sqlite`);
	databaseIndex += 1;
	copyFileSync(seededPath, path);
	const db = openDatabase(path);
	db.exec(
		"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
	);
	return db;
}

function apply(db: Database, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function legacyRows(db: Database) {
	return LEGACY_TABLES.map((table) =>
		db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()
	);
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

describe("migration 0063 — ledger and category cutover", () => {
	let db: Database;

	beforeAll(() => {
		const seeded = openDatabase();
		try {
			seeded.exec("PRAGMA foreign_keys=ON");
			for (const statements of beforeEntryCutover) {
				for (const statement of statements) {
					seeded.exec(statement);
				}
			}
			seeded.exec(SEED);
			for (const statement of cutoversBeforeTarget) {
				seeded.exec(statement);
			}
			seeded.prepare("VACUUM INTO ?").run(seededPath);
		} finally {
			seeded.close();
		}
	});

	afterAll(() => {
		rmSync(snapshotDirectory, { force: true, recursive: true });
	});

	beforeEach(() => {
		db = seededDatabase();
	});

	afterEach(() => db?.close());

	it("moves categories by id with duplicates merged into the oldest, and every amount into lines with the projector's ids", () => {
		const legacyBefore = legacyRows(db);

		apply(db);

		expect(
			values(
				db,
				"SELECT id, user_id, name, created_at, updated_at, archived_at FROM ledger_category ORDER BY id"
			)
		).toEqual([
			["bob-deposit", "bob", "Deposit", 5, 6, null],
			["deposit", "alice", "Deposit", 1, 2, null],
			["z-withdraw", "alice", "Withdraw", 3, 4, null],
		]);
		expect(
			values(
				db,
				"SELECT id, user_id, name, kind, decimals FROM asset WHERE id LIKE 'unassigned:%' ORDER BY id"
			)
		).toEqual([
			["unassigned:alice", "alice", "Unassigned", "currency", 0],
			["unassigned:bob", "bob", "Unassigned (migrated)", "currency", 0],
		]);
		expect(values(db, "SELECT id, asset_id FROM entry ORDER BY id")).toEqual([
			["bob-manual", "unassigned:bob"],
			["live-cash", "alice-jpy"],
			["live-mtt", "unassigned:alice"],
			["live-open", "alice-jpy"],
			["manual-cash", "alice-jpy"],
			["manual-empty", null],
			["manual-mtt", "unassigned:alice"],
		]);
		const mttStart = midnight + 3600;
		expect(
			values(
				db,
				"SELECT entry_id, id, user_id, asset_id, quantity, role, source_event_id, occurred_at FROM ledger_line WHERE entry_id IS NOT NULL ORDER BY entry_id, id"
			)
		).toEqual([
			[
				"bob-manual",
				"m:bob-manual:buy_in:0",
				"bob",
				"unassigned:bob",
				-10,
				"buy_in",
				null,
				noon,
			],
			[
				"live-cash",
				"cash-add:0",
				"alice",
				"alice-jpy",
				-50,
				"addon",
				"cash-add",
				live + 60,
			],
			[
				"live-cash",
				"cash-end:0",
				"alice",
				"alice-jpy",
				200,
				"cash_out",
				"cash-end",
				live + 300,
			],
			[
				"live-cash",
				"cash-remove:0",
				"alice",
				"alice-jpy",
				30,
				"chip_remove",
				"cash-remove",
				live + 120,
			],
			[
				"live-cash",
				"cash-start:0",
				"alice",
				"alice-jpy",
				-100,
				"buy_in",
				"cash-start",
				live,
			],
			[
				"live-mtt",
				"mtt-end:0",
				"alice",
				"unassigned:alice",
				400,
				"bounty",
				"mtt-end",
				live + 120,
			],
			[
				"live-mtt",
				"mtt-rebuy:0",
				"alice",
				"unassigned:alice",
				-500,
				"chip_purchase",
				"mtt-rebuy",
				live + 60,
			],
			[
				"live-mtt",
				"mtt-start:0",
				"alice",
				"unassigned:alice",
				-2000,
				"buy_in",
				"mtt-start",
				live,
			],
			[
				"live-mtt",
				"mtt-start:1",
				"alice",
				"unassigned:alice",
				-150,
				"fee",
				"mtt-start",
				live,
			],
			[
				"live-open",
				"open-start:0",
				"alice",
				"alice-jpy",
				-300,
				"buy_in",
				"open-start",
				live,
			],
			[
				"manual-cash",
				"m:manual-cash:buy_in:0",
				"alice",
				"alice-jpy",
				-100,
				"buy_in",
				null,
				noon,
			],
			[
				"manual-cash",
				"m:manual-cash:cash_out:0",
				"alice",
				"alice-jpy",
				150,
				"cash_out",
				null,
				noon,
			],
			[
				"manual-cash",
				"m:manual-cash:chip_remove:0",
				"alice",
				"alice-jpy",
				30,
				"chip_remove",
				null,
				noon,
			],
			[
				"manual-mtt",
				"m:manual-mtt:buy_in:0",
				"alice",
				"unassigned:alice",
				-1000,
				"buy_in",
				null,
				mttStart,
			],
			[
				"manual-mtt",
				"m:manual-mtt:chip_purchase:0",
				"alice",
				"unassigned:alice",
				-200,
				"chip_purchase",
				null,
				mttStart,
			],
			[
				"manual-mtt",
				"m:manual-mtt:chip_purchase:1",
				"alice",
				"unassigned:alice",
				-300,
				"chip_purchase",
				null,
				mttStart,
			],
			[
				"manual-mtt",
				"m:manual-mtt:chip_purchase:2",
				"alice",
				"unassigned:alice",
				-300,
				"chip_purchase",
				null,
				mttStart,
			],
			[
				"manual-mtt",
				"m:manual-mtt:fee:0",
				"alice",
				"unassigned:alice",
				-100,
				"fee",
				null,
				mttStart,
			],
			[
				"manual-mtt",
				"m:manual-mtt:prize:0",
				"alice",
				"unassigned:alice",
				5000,
				"prize",
				null,
				mttStart,
			],
		]);
		expect(
			values(
				db,
				"SELECT DISTINCT effect, entry_id = play_session_id, category_id, memo FROM ledger_line WHERE entry_id IS NOT NULL"
			)
		).toEqual([["real", 1, null, null]]);
		expect(
			values(
				db,
				"SELECT id, user_id, asset_id, quantity, role, effect, play_session_id, source_event_id, category_id, occurred_at, memo, created_at, updated_at FROM ledger_line WHERE entry_id IS NULL ORDER BY id"
			)
		).toEqual([
			[
				"w-deposit",
				"alice",
				"alice-jpy",
				5000,
				"adjustment",
				"real",
				null,
				null,
				"deposit",
				midnight + 60,
				"cash in",
				7,
				7,
			],
			[
				"w-foreign-type",
				"bob",
				"bob-jpy",
				300,
				"adjustment",
				"real",
				null,
				null,
				null,
				midnight + 300,
				null,
				12,
				12,
			],
			[
				"w-reserved",
				"alice",
				"alice-jpy",
				700,
				"adjustment",
				"real",
				null,
				null,
				null,
				midnight + 180,
				null,
				9,
				9,
			],
			[
				"w-withdraw",
				"alice",
				"alice-jpy",
				-2000,
				"adjustment",
				"real",
				null,
				null,
				"z-withdraw",
				midnight + 120,
				null,
				8,
				8,
			],
		]);
		expect(legacyRows(db)).toEqual(legacyBefore);
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
		expect(
			values(
				db,
				"SELECT name FROM sqlite_master WHERE name LIKE '\\_\\_%' ESCAPE '\\'"
			)
		).toEqual([]);
	});

	it.each([
		[
			"a category no transaction type had",
			"categories_match",
			"INSERT INTO ledger_category (id, user_id, name, updated_at) VALUES ('extra', 'alice', 'Extra', 2)",
		],
		[
			"a Session Result category",
			"categories_match",
			"INSERT INTO ledger_category (id, user_id, name, updated_at) VALUES ('alice-result', 'alice', 'Session Result', 2)",
		],
		[
			"a changed wallet amount",
			"wallet_lines_match",
			"UPDATE ledger_line SET quantity = 4999 WHERE id = 'w-deposit'",
		],
		[
			"a wallet line that lost its merged category",
			"wallet_lines_match",
			"UPDATE ledger_line SET category_id = NULL WHERE id = 'w-withdraw'",
		],
		[
			"a session-linked result moved as a wallet line",
			"wallet_lines_match",
			"INSERT INTO ledger_line (id, user_id, asset_id, quantity, role, effect, occurred_at, updated_at) VALUES ('w-session', 'alice', 'alice-jpy', 80, 'adjustment', 'real', 1, 2)",
		],
		[
			"a line in another asset than its entry",
			"line_assets_match",
			"UPDATE ledger_line SET asset_id = 'alice-jpy' WHERE id = 'mtt-start:0'",
		],
		[
			"a lost entry line",
			"line_assets_match",
			"DELETE FROM ledger_line WHERE id = 'open-start:0'",
		],
		[
			"a settled entry whose lines no longer add up to the legacy result",
			"profit_loss_matches",
			"UPDATE ledger_line SET quantity = 199 WHERE id = 'cash-end:0'",
		],
		[
			"a live result the legacy columns never recorded",
			"profit_loss_matches",
			"UPDATE session_cash_detail SET buy_in = NULL, cash_out = NULL, chip_remove_total = NULL WHERE session_id = 'live-cash'",
		],
		[
			"a dangling foreign key",
			"foreign_keys_valid",
			"PRAGMA foreign_keys=OFF; INSERT INTO entry_cash (entry_id, user_id, kind) VALUES ('ghost', 'alice', 'cash'); PRAGMA foreign_keys=ON",
		],
	])("stops the deploy on %s", (_name, gate, corrupt) => {
		expect(gateIndex).toBeGreaterThan(0);
		apply(db, targetStatements.slice(0, gateIndex));
		db.exec(corrupt);

		expect(() => apply(db, targetStatements.slice(gateIndex))).toThrow(
			`NOT NULL constraint failed: __gate_0063.${gate}`
		);
	});
});
