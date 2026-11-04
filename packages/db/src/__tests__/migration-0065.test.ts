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
	stringValue,
} from "./sqlite";

const TARGET_MIGRATION = "0065_game_master_final.sql";
const LABELS_GATE = /NOT NULL constraint failed: __gate_0065\.labels_unique/;

const beforeEntryCutover = migrationFiles("0061_").map(statementsOf);
const cutoversBeforeTarget = migrationFiles(TARGET_MIGRATION)
	.filter((name) => name >= "0061_")
	.map(statementsOf);
const targetStatements = statementsOf(TARGET_MIGRATION);

const day = Date.parse("2026-10-08T00:00:00Z") / 1000;

const LEGACY_SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO game_group (id, user_id, builtin_key, label, blind1_label, blind2_label, blind3_label, created_at, updated_at) VALUES
 ('a-bigbet', 'alice', 'bigbet', 'Big Bet', 'SB', 'BB', NULL, 1, 2),
 ('a-stud', 'alice', NULL, 'Stud', 'Ante', NULL, NULL, 3, 4),
 ('b-bigbet', 'bob', 'bigbet', 'Big Bet', 'SB', 'BB', NULL, 1, 2);
INSERT INTO game_variant (id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at) VALUES
 ('a-nlh', 'alice', 'nlh', 'NL Hold''em', 'NLH', 'a-bigbet', 0, 10, 11),
 ('a-plo', 'alice', 'plo', 'PL Omaha', NULL, 'a-bigbet', 1, 12, 13),
 ('a-razz', 'alice', NULL, 'Razz', 'R', 'a-stud', 7, 14, 15),
 ('b-nlh', 'bob', 'nlh', 'NL Hold''em', 'NLH', 'b-bigbet', 0, 16, 17);
INSERT INTO game_mix (id, user_id, builtin_key, label, games, created_at, updated_at) VALUES
 ('a-mix', 'alice', NULL, 'Rotation', '["a-plo","a-nlh","a-razz"]', 20, 21),
 ('b-mix', 'bob', NULL, 'Solo', '["b-nlh"]', 22, 23);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, hand_count, created_at, updated_at) VALUES
 ('a-cash', 'alice', 'cash_game', 'manual', 'completed', ${day}, 3, 1, 2),
 ('b-cash', 'bob', 'cash_game', 'manual', 'completed', ${day}, 1, 1, 2);
`;

const V2_SEED = `
UPDATE hand SET variant_id = 'a-plo' WHERE user_id = 'alice' AND hand_no = 1;
UPDATE hand SET variant_id = 'a-razz' WHERE user_id = 'alice' AND hand_no = 3;
UPDATE hand SET variant_id = 'b-nlh' WHERE user_id = 'bob';
INSERT INTO game_lineup (id, user_id, game_mix_id) VALUES ('a-lineup', 'alice', 'a-mix');
INSERT INTO game_lineup_group (id, user_id, lineup_id, position, game_group_id) VALUES
 ('a-lineup-bigbet', 'alice', 'a-lineup', 0, 'a-bigbet'),
 ('a-lineup-stud', 'alice', 'a-lineup', 1, 'a-stud');
INSERT INTO game_lineup_variant (user_id, lineup_id, lineup_group_id, variant_id, position) VALUES
 ('alice', 'a-lineup', 'a-lineup-bigbet', 'a-plo', 0),
 ('alice', 'a-lineup', 'a-lineup-bigbet', 'a-nlh', 1),
 ('alice', 'a-lineup', 'a-lineup-stud', 'a-razz', 0);
`;

const REFERENCE_QUERIES = {
	variants:
		"SELECT id, user_id, builtin_key, label, short_label, group_id, sort_order, created_at, updated_at FROM game_variant ORDER BY id",
	mixVariants:
		"SELECT mix_id, variant_id, user_id, position FROM game_mix_variant ORDER BY mix_id, position",
	lineupVariants:
		"SELECT lineup_group_id, variant_id, user_id, lineup_id, position FROM game_lineup_variant ORDER BY lineup_group_id, position",
	handLinks: "SELECT id, user_id, variant_id FROM hand ORDER BY id",
} as const;

function references(db: Database) {
	return Object.fromEntries(
		Object.entries(REFERENCE_QUERIES).map(([key, sql]) => [
			key,
			db.prepare(sql).all(),
		])
	);
}

const snapshotDirectory = mkdtempSync(
	join(tmpdir(), "sapphire2-migration-0065-")
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

function apply(db: Database, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function values(db: Database, sql: string): unknown[] {
	return rowValues(db.prepare(sql));
}

describe("migration 0065 — final game master DDL", () => {
	let db: Database;

	beforeAll(() => {
		const seeded = openDatabase();
		try {
			seeded.exec("PRAGMA foreign_keys=ON");
			for (const statements of beforeEntryCutover) {
				apply(seeded, statements);
			}
			seeded.exec(LEGACY_SEED);
			for (const statements of cutoversBeforeTarget) {
				apply(seeded, statements);
			}
			seeded.exec(V2_SEED);
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

	it("keeps every variant and every mix, lineup and hand reference to it, and leaves no trigger or stage", () => {
		const before = references(db);
		expect(before.mixVariants).toHaveLength(4);
		expect(before.lineupVariants).toHaveLength(3);
		expect(
			values(db, "SELECT count(*) FROM hand WHERE variant_id IS NOT NULL")
		).toEqual([[3]]);

		apply(db);

		expect(references(db)).toEqual(before);
		expect(values(db, "SELECT archived_at FROM game_variant")).toEqual([
			[null],
			[null],
			[null],
			[null],
		]);
		expect(
			values(
				db,
				"SELECT name FROM sqlite_master WHERE type = 'trigger' OR (type = 'table' AND name LIKE '\\_\\_%' ESCAPE '\\')"
			)
		).toEqual([]);
		expect(values(db, "PRAGMA foreign_keys")).toEqual([[1]]);
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
	});

	it("aborts before staging when one table already holds a normalized duplicate label", () => {
		const trigger = db
			.prepare(
				"SELECT sql FROM sqlite_master WHERE name = 'game_variant_label_unique_insert'"
			)
			.get();
		const triggerSql = stringValue(trigger?.sql);
		db.exec("DROP TRIGGER game_variant_label_unique_insert");
		db.exec(`
			INSERT INTO game_variant (id, user_id, label, group_id, sort_order, updated_at)
			VALUES ('a-nlh-copy', 'alice', ' nl HOLD''EM ', 'a-bigbet', 9, 1)
		`);
		db.exec(triggerSql);

		expect(() => apply(db)).toThrow(LABELS_GATE);
		expect(values(db, "SELECT count(*) FROM game_variant")).toEqual([[5]]);
		expect(values(db, "SELECT count(*) FROM game_mix_variant")).toEqual([[4]]);
		expect(
			values(
				db,
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_\\_%' ESCAPE '\\'"
			)
		).toEqual([["__gate_0065"]]);
	});
});
