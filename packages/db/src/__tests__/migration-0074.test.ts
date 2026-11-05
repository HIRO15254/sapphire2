import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
	stringValue,
} from "./sqlite";

const TARGET = "0073_stand_in_cleanup.sql";
const LOCAL_DATES_GATE = /NOT NULL constraint failed: __gate_0073\.local_dates/;
const PRICES_GATE = /NOT NULL constraint failed: __gate_0073\.prices/;
const beforeEntry = migrationFiles("0061_").map(statementsOf);
const cutovers = migrationFiles(TARGET)
	.filter((name) => name >= "0061_")
	.map(statementsOf);
const targetStatements = statementsOf(TARGET);
const directory = mkdtempSync(join(tmpdir(), "sapphire2-migration-0073-"));
let index = 0;

const day = Date.parse("2026-10-08T00:00:00Z") / 1000;
const live = day + 20 * 3600;

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO room (id, user_id, name, updated_at) VALUES
 ('club', 'alice', 'Club', 2), ('casino', 'alice', 'Casino', 2), ('mixed', 'alice', 'Mixed', 2),
 ('far', 'alice', 'Far', 2), ('bob-room', 'bob', 'Bob Room', 2);
INSERT INTO asset (id, user_id, name, updated_at) VALUES
 ('chip', 'alice', 'Club Chip', 2), ('casino-coin', 'alice', ' CASINO ', 2),
 ('a1', 'alice', 'A1', 2), ('a2', 'alice', 'A2', 2);
INSERT INTO tournament (id, user_id, room_id, name, variant, buy_in, entry_fee, starting_stack, table_size, currency_id, created_at, updated_at) VALUES
 ('far-mtt', 'alice', 'far', 'Far Main', 'NL Hold''em', 1000, 100, 5000, 9, NULL, 1, 2);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, room_id, currency_id, created_at, updated_at) VALUES
 ('club-live', 'alice', 'cash_game', 'live', 'completed', ${day}, ${live}, ${live + 600}, 0, 'club', NULL, 1, 2),
 ('club-manual', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'club', 'chip', 1, 2),
 ('casino-manual', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'casino', NULL, 1, 2),
 ('mixed-a', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'mixed', 'a1', 1, 2),
 ('mixed-b', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'mixed', 'a2', 1, 2),
 ('mixed-null', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'mixed', NULL, 1, 2),
 ('roomless', 'alice', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, NULL, NULL, 1, 2),
 ('bob-manual', 'bob', 'cash_game', 'manual', 'completed', ${day}, NULL, NULL, 0, 'bob-room', NULL, 1, 2);
INSERT INTO session_cash_detail (session_id, buy_in, cash_out, variant, blind1, blind2) VALUES
 ('club-live', 150, 200, 'NL Hold''em', 1, 2),
 ('club-manual', 100, 150, 'NL Hold''em', 1, 2),
 ('casino-manual', 100, 50, 'NL Hold''em', 1, 2),
 ('mixed-a', 100, 50, 'NL Hold''em', 1, 2),
 ('mixed-b', 100, 50, 'NL Hold''em', 1, 2),
 ('mixed-null', 100, 50, 'NL Hold''em', 1, 2),
 ('roomless', 100, 50, 'NL Hold''em', 1, 2),
 ('bob-manual', 10, 0, 'NL Hold''em', 1, 2);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('club-start', 'club-live', 'session_start', ${live}, 0, '{"buyInAmount":100}', 1, 2),
 ('club-add', 'club-live', 'chips_add_remove', ${live + 60}, 1, '{"amount":50}', 1, 2),
 ('club-end', 'club-live', 'session_end', ${live + 600}, 2, '{"cashOutAmount":200}', 1, 2);
`;

const SHARED_PRICE_SEED = `
INSERT INTO tournament (id, user_id, room_id, name, variant, buy_in, entry_fee, starting_stack, table_size, currency_id, created_at, updated_at) VALUES
 ('club-mtt', 'alice', 'club', 'Club Main', 'NL Hold''em', 1000, 100, 5000, 9, NULL, 1, 2);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, break_minutes, room_id, currency_id, created_at, updated_at) VALUES
 ('casino-mtt', 'alice', 'tournament', 'manual', 'completed', ${day}, 0, 'casino', NULL, 1, 2);
INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee, placement, total_entries, prize_money, variant, starting_stack, table_size) VALUES
 ('casino-mtt', 'club-mtt', 1000, 100, 3, 10, 0, 'NL Hold''em', 5000, 9);
`;

function apply(db: Database, statements: string[]): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function migratedBeforeTarget(extraSeed = ""): Database {
	const path = join(directory, `${index++}.sqlite`);
	const db = openDatabase(path);
	db.exec(
		"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
	);
	try {
		for (const statements of beforeEntry) {
			apply(db, statements);
		}
		db.exec(SEED + extraSeed);
		for (const statements of cutovers) {
			apply(db, statements);
		}
	} catch (error) {
		db.close();
		throw error;
	}
	return db;
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

function payload(db: Database, id: string): unknown {
	const [row] = values(db, `SELECT payload FROM play_event WHERE id = '${id}'`);
	return JSON.parse(stringValue(row?.[0]));
}

describe("migration 0073 — stand-in cleanup", () => {
	const seededPath = join(directory, "seeded.sqlite");
	let seeded = (): Database => {
		throw new Error("seed not built");
	};
	beforeAll(() => {
		const source = migratedBeforeTarget();
		source.prepare("VACUUM INTO ?").run(seededPath);
		source.close();
		seeded = () => {
			const path = join(directory, `${index++}.sqlite`);
			copyFileSync(seededPath, path);
			const db = openDatabase(path);
			db.exec(
				"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
			);
			return db;
		};
	});
	afterAll(() => rmSync(directory, { recursive: true, force: true }));

	it("moves Unassigned references in a room to the room's only asset, else to the asset named after the room", () => {
		const db = seeded();
		try {
			expect(
				values(
					db,
					"SELECT id, asset_id FROM entry WHERE asset_id LIKE 'unassigned:%' ORDER BY id"
				)
			).toEqual([
				["bob-manual", "unassigned:bob"],
				["casino-manual", "unassigned:alice"],
				["club-live", "unassigned:alice"],
				["mixed-null", "unassigned:alice"],
				["roomless", "unassigned:alice"],
			]);
			apply(db, targetStatements);

			expect(values(db, "SELECT id, asset_id FROM entry ORDER BY id")).toEqual([
				["bob-manual", "room-asset:bob-room"],
				["casino-manual", "casino-coin"],
				["club-live", "chip"],
				["club-manual", "chip"],
				["mixed-a", "a1"],
				["mixed-b", "a2"],
				["mixed-null", "room-asset:mixed"],
				["roomless", "unassigned:alice"],
			]);
			expect(
				values(
					db,
					"SELECT id, user_id, name, kind, archived_at FROM asset WHERE id LIKE 'room-asset:%' OR id LIKE 'unassigned:%' ORDER BY id"
				)
			).toEqual([
				["room-asset:bob-room", "bob", "Bob Room", "currency", null],
				["room-asset:far", "alice", "Far", "currency", null],
				["room-asset:mixed", "alice", "Mixed", "currency", null],
				["unassigned:alice", "alice", "Unassigned", "currency", null],
				["unassigned:bob", "bob", "Unassigned", "currency", null],
			]);
			expect(
				values(
					db,
					"SELECT DISTINCT l.entry_id, l.asset_id FROM ledger_line l WHERE l.entry_id IS NOT NULL AND l.asset_id IS NOT (SELECT e.asset_id FROM entry e WHERE e.id = l.entry_id)"
				)
			).toEqual([]);
			expect(
				values(
					db,
					"SELECT entry_id, asset_id, count(*) FROM ledger_line WHERE entry_id IN ('club-live', 'roomless') GROUP BY entry_id, asset_id ORDER BY entry_id"
				)
			).toEqual([
				["club-live", "chip", 3],
				["roomless", "unassigned:alice", 2],
			]);
			expect(payload(db, "club-start")).toEqual({
				payments: [
					{ assetId: "chip", quantity: 100, role: "buy_in", effect: "real" },
				],
			});
			expect(payload(db, "club-add")).toEqual({
				amount: 50,
				assetId: "chip",
				effect: "real",
			});
			expect(
				values(
					db,
					"SELECT count(*) FROM play_event WHERE payload LIKE '%unassigned:%'"
				)
			).toEqual([[0]]);
			expect(
				values(
					db,
					"SELECT p.asset_id FROM tournament_rule_price p JOIN tournament_rule r ON r.id = p.rule_id WHERE r.tournament_id = 'far-mtt'"
				)
			).toEqual([["room-asset:far"]]);
			expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
			expect(
				values(db, "SELECT name FROM sqlite_master WHERE name LIKE '%0073%'")
			).toEqual([]);
		} finally {
			db.close();
		}
	});

	it("leaves migrated live dates alone for an owner in Asia/Tokyo or without a time zone", () => {
		const db = seeded();
		try {
			db.exec(
				"INSERT INTO user_setting (user_id, time_zone, updated_at) VALUES ('alice', 'Asia/Tokyo', 2)"
			);
			const before = values(
				db,
				"SELECT id, local_date FROM play_session ORDER BY id"
			);
			expect(before).toContainEqual(["club-live", "2026-10-09"]);
			apply(db, targetStatements);
			expect(
				values(db, "SELECT id, local_date FROM play_session ORDER BY id")
			).toEqual(before);
		} finally {
			db.close();
		}
	});

	it("aborts rather than keep a JST date for an owner in another time zone", () => {
		const db = seeded();
		try {
			db.exec(
				"INSERT INTO user_setting (user_id, time_zone, updated_at) VALUES ('alice', 'America/New_York', 2)"
			);
			expect(() => apply(db, targetStatements)).toThrow(LOCAL_DATES_GATE);
		} finally {
			db.close();
		}
	});

	it("aborts when an entry's room and its master's room map a shared price to different assets", () => {
		const db = migratedBeforeTarget(SHARED_PRICE_SEED);
		try {
			expect(() => apply(db, targetStatements)).toThrow(PRICES_GATE);
		} finally {
			db.close();
		}
	});
});
