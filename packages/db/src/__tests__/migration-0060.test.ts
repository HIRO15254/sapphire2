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

const TARGET_MIGRATION = "0060_rebuild_currency_as_asset.sql";
const V2_CHILDREN_GATE =
	/NOT NULL constraint failed: __gate_0060\.v2_children_empty/;

const earlierMigrations = migrationFiles("0060_").map(statementsOf);
const targetStatements = statementsOf(TARGET_MIGRATION);

const SEED = `
	INSERT INTO user (id, name, email) VALUES
		('alice', 'Alice', 'alice@example.test'),
		('bob', 'Bob', 'bob@example.test');
	INSERT INTO currency (id, user_id, name, unit, description, is_favorite, kind, decimals, archived_at, created_at, updated_at) VALUES
		('a-chips', 'alice', 'Chips', 'PT', '<p>Club</p>', 1, 'currency', 0, NULL, 100, 7),
		('a-chips-lower', 'alice', 'chips', NULL, NULL, 0, 'currency', 0, NULL, 100, 8),
		('a-chips-spaced', 'alice', '  CHIPS ', NULL, NULL, 0, 'item', 2, 900, 200, 9),
		('a-chips-2', 'alice', 'Chips (2)', NULL, NULL, 0, 'currency', 0, NULL, 300, 10),
		('a-usd', 'alice', 'USD', '$', NULL, 0, 'currency', 2, NULL, 50, 11),
		('b-chips', 'bob', 'chips', NULL, NULL, 0, 'currency', 0, NULL, 100, 12),
		('b-chips-copy', 'bob', 'Chips', NULL, NULL, 0, 'currency', 0, NULL, 100, 13);
	INSERT INTO transaction_type (id, user_id, name, updated_at) VALUES
		('alice-type', 'alice', 'Adjustment', 1),
		('bob-type', 'bob', 'Adjustment', 1);
	INSERT INTO room (id, user_id, name, updated_at) VALUES ('club', 'alice', 'Club', 1);
	INSERT INTO ring_game (id, user_id, room_id, currency_id, name, updated_at) VALUES
		('ring', 'alice', 'club', 'a-chips-2', 'Ring', 1),
		('ring-plain', 'alice', 'club', NULL, 'Plain', 1);
	INSERT INTO tournament (id, user_id, room_id, currency_id, name, updated_at) VALUES
		('daily', 'alice', 'club', 'a-chips-spaced', 'Daily', 1);
	INSERT INTO game_session (id, user_id, kind, status, source, session_date, currency_id, updated_at) VALUES
		('cash', 'alice', 'cash_game', 'completed', 'manual', 1, 'a-chips-lower', 1),
		('mtt', 'alice', 'tournament', 'completed', 'manual', 1, NULL, 1),
		('bob-cash', 'bob', 'cash_game', 'completed', 'manual', 1, 'b-chips-copy', 1);
	INSERT INTO currency_transaction (id, currency_id, transaction_type_id, session_id, amount, transacted_at, memo, created_at) VALUES
		('result', 'a-chips-lower', 'alice-type', 'cash', 1500, 10, NULL, 20),
		('deposit', 'a-usd', 'alice-type', NULL, -300, 11, 'Top up', 21),
		('bob-result', 'b-chips-copy', 'bob-type', 'bob-cash', 40, 12, NULL, 22);
`;

const LEGACY_QUERIES = {
	transactions: "SELECT * FROM currency_transaction ORDER BY id",
	sessionLinks: "SELECT id, currency_id FROM game_session ORDER BY id",
	ringGameLinks: "SELECT id, currency_id FROM ring_game ORDER BY id",
	tournamentLinks: "SELECT id, currency_id FROM tournament ORDER BY id",
} as const;

function legacyChildren(db: Database) {
	return Object.fromEntries(
		Object.entries(LEGACY_QUERIES).map(([key, sql]) => [
			key,
			db.prepare(sql).all(),
		])
	);
}

const snapshotDirectory = mkdtempSync(
	join(tmpdir(), "sapphire2-migration-0060-")
);
const seededPath = join(snapshotDirectory, "seeded.sqlite");
let databaseIndex = 0;

function seededDatabase(): Database {
	const path = join(snapshotDirectory, `${databaseIndex++}.sqlite`);
	copyFileSync(seededPath, path);
	const db = openDatabase(path);
	db.exec(
		"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
	);
	return db;
}

function apply(db: Database): void {
	for (const statement of targetStatements) {
		db.exec(statement);
	}
}

function tableNames(db: Database): unknown[] {
	return rowValues(
		db.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND (name IN ('currency', 'asset') OR name LIKE '\\_\\_%' ESCAPE '\\') ORDER BY name"
		)
	).flat();
}

describe("migration 0060 — currency rebuilt and renamed to asset", () => {
	let db: Database;

	beforeAll(() => {
		const seeded = openDatabase();
		try {
			seeded.exec("PRAGMA foreign_keys=ON");
			for (const statements of earlierMigrations) {
				for (const statement of statements) {
					seeded.exec(statement);
				}
			}
			seeded.exec(SEED);
			seeded.prepare("VACUUM INTO ?").run(seededPath);
		} finally {
			seeded.close();
		}
	});

	afterAll(() => {
		rmSync(snapshotDirectory, { recursive: true, force: true });
	});

	beforeEach(() => {
		db = seededDatabase();
	});

	afterEach(() => db?.close());

	it("keeps every asset id and column, every transaction and every master and session link", () => {
		const assetsBefore = db
			.prepare(
				"SELECT id, user_id, unit, description, is_favorite, kind, decimals, archived_at, created_at, updated_at FROM currency ORDER BY id"
			)
			.all();
		const childrenBefore = legacyChildren(db);

		apply(db);

		expect(
			db
				.prepare(
					"SELECT id, user_id, unit, description, is_favorite, kind, decimals, archived_at, created_at, updated_at FROM asset ORDER BY id"
				)
				.all()
		).toEqual(assetsBefore);
		expect(legacyChildren(db)).toEqual(childrenBefore);
		expect(tableNames(db)).toEqual(["asset"]);
		expect(rowValues(db.prepare("PRAGMA foreign_keys"))).toEqual([[1]]);
		expect(rowValues(db.prepare("PRAGMA foreign_key_check"))).toEqual([]);
	});

	it("renames later duplicates per user with the smallest unused suffix in (created_at, id) order", () => {
		apply(db);

		expect(db.prepare("SELECT id, name FROM asset ORDER BY id").all()).toEqual([
			{ id: "a-chips", name: "Chips" },
			{ id: "a-chips-2", name: "Chips (2)" },
			{ id: "a-chips-lower", name: "chips (3)" },
			{ id: "a-chips-spaced", name: "CHIPS (4)" },
			{ id: "a-usd", name: "USD" },
			{ id: "b-chips", name: "chips" },
			{ id: "b-chips-copy", name: "Chips (2)" },
		]);
	});

	it("points every child foreign key at asset and keeps the cascade of an asset delete", () => {
		apply(db);

		for (const child of [
			"currency_transaction",
			"game_session",
			"ring_game",
			"tournament",
			"entry",
			"asset_rate",
			"ledger_line",
			"user_setting",
			"tournament_rule_price",
		]) {
			expect(
				db
					.prepare(
						"SELECT DISTINCT \"table\" AS target FROM pragma_foreign_key_list(?) WHERE \"table\" IN ('currency', 'asset')"
					)
					.all(child),
				child
			).toEqual([{ target: "asset" }]);
		}

		db.exec("DELETE FROM asset WHERE id = 'a-chips-lower'");

		expect(
			rowValues(db.prepare("SELECT id FROM currency_transaction ORDER BY id"))
		).toEqual([["bob-result"], ["deposit"]]);
		expect(
			db.prepare("SELECT currency_id FROM game_session WHERE id = 'cash'").get()
		).toEqual({ currency_id: null });
	});

	it("aborts before dropping currency when a v2 child already holds rows", () => {
		db.exec(`
			INSERT INTO asset_rate (id, user_id, base_asset_id, quote_asset_id, rate_num, rate_den, effective_from)
			VALUES ('rate', 'alice', 'a-usd', 'a-chips', 150, 1, 0);
		`);

		expect(() => apply(db)).toThrow(V2_CHILDREN_GATE);
		expect(tableNames(db)).toEqual(["__gate_0060", "currency"]);
		expect(rowValues(db.prepare("SELECT id FROM asset_rate"))).toEqual([
			["rate"],
		]);
	});
});
