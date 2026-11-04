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

const TARGET_MIGRATION = "0062_hand_count_cutover.sql";
const beforeCutover = migrationFiles("0061_").map(statementsOf);
const cutover = statementsOf("0061_entry_p1_cutover.sql");
const targetStatements = statementsOf(TARGET_MIGRATION);
const gateIndex = targetStatements.findIndex((statement) =>
	statement.startsWith("CREATE TABLE `__gate_0062`")
);

const day = Date.parse("2026-10-08T00:00:00Z") / 1000;

const SESSIONS: [
	id: string,
	handCount: number | null,
	dealerSeat: number | null,
][] = [
	["none", null, 3],
	["zero", 0, 2],
	["negative", -4, 1],
	["three", 3, 4],
	["no-button", 2, null],
	["bad-button", 1, 12],
	["max", 5000, 0],
];

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO game_session
 (id, user_id, kind, source, status, session_date, hand_count, dealer_seat, created_at, updated_at) VALUES
${SESSIONS.map(
	([id, handCount, dealerSeat], index) =>
		` ('${id}', '${index % 2 === 0 ? "alice" : "bob"}', '${index % 3 === 0 ? "tournament" : "cash_game"}', 'manual', 'completed', ${day}, ${handCount ?? "NULL"}, ${dealerSeat ?? "NULL"}, 1, 2)`
).join(",\n")};
`;

const snapshotDirectory = mkdtempSync(
	join(tmpdir(), "sapphire2-migration-0062-")
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

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

describe("migration 0062 — hand count cutover", () => {
	let db: Database;

	beforeAll(() => {
		const seeded = openDatabase();
		try {
			seeded.exec("PRAGMA foreign_keys=ON");
			for (const statements of beforeCutover) {
				apply(seeded, statements);
			}
			seeded.exec(SEED);
			apply(seeded, cutover);
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

	it("expands each hand count into numbered count hands on seq 1 whose last hand carries the dealer seat", () => {
		apply(db);

		expect(
			values(
				db,
				`SELECT p.id, count(h.id), min(h.hand_no), max(h.hand_no),
				 (SELECT button_seat FROM hand WHERE play_session_id = p.id ORDER BY hand_no DESC LIMIT 1),
				 sum(h.button_seat IS NOT NULL)
				 FROM play_session p LEFT JOIN hand h ON h.play_session_id = p.id AND h.user_id = p.user_id
				 GROUP BY p.id ORDER BY p.id`
			)
		).toEqual([
			["bad-button", 1, 1, 1, null, 0],
			["max", 5000, 1, 5000, 0, 1],
			["negative", 0, null, null, null, 0],
			["no-button", 2, 1, 2, null, 0],
			["none", 0, null, null, null, 0],
			["three", 3, 1, 3, 4, 1],
			["zero", 0, null, null, null, 0],
		]);
		expect(
			values(
				db,
				"SELECT id, user_id, hand_no, played_at, detail, button_seat, pot, memo FROM hand WHERE play_session_id = 'three' ORDER BY hand_no"
			)
		).toEqual([
			["h:three:1", "bob", 1, null, "count", null, null, null],
			["h:three:2", "bob", 2, null, "count", null, null, null],
			["h:three:3", "bob", 3, null, "count", 4, null, null],
		]);
		expect(
			values(
				db,
				"SELECT count(*) FROM hand h JOIN play_session p ON p.id = h.play_session_id WHERE h.user_id <> p.user_id OR p.seq <> 1"
			)
		).toEqual([[0]]);
		expect(
			values(
				db,
				"SELECT count(*) FROM sqlite_master WHERE name = '__gate_0062'"
			)
		).toEqual([[0]]);
	});

	it("fails instead of truncating a hand count above the 5,000-hand expansion cap", () => {
		db.exec("UPDATE game_session SET hand_count = 5001 WHERE id = 'max'");

		expect(() => apply(db)).toThrow(
			"NOT NULL constraint failed: __gate_0062.hands_match"
		);
	});

	it.each([
		["a lost hand", "DELETE FROM hand WHERE id = 'h:three:2'"],
		[
			"a changed last button",
			"UPDATE hand SET button_seat = 5 WHERE id = 'h:three:3'",
		],
		[
			"a button left on an earlier hand only",
			"UPDATE hand SET button_seat = NULL WHERE id = 'h:three:3'; UPDATE hand SET button_seat = 4 WHERE id = 'h:three:2'",
		],
	])("stops the deploy on %s", (_name, corrupt) => {
		expect(gateIndex).toBeGreaterThan(0);
		apply(db, targetStatements.slice(0, gateIndex));
		db.exec(corrupt);

		expect(() => apply(db, targetStatements.slice(gateIndex))).toThrow(
			"NOT NULL constraint failed: __gate_0062.hands_match"
		);
	});
});
