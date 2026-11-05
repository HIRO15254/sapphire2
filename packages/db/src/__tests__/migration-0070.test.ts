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
import type { EntryKind } from "../constants/entry";
import { playEventPayloadSchema } from "../constants/play-event-payloads";
import {
	type Database,
	migrationFiles,
	openDatabase,
	rowValues,
	statementsOf,
	stringValue,
} from "./sqlite";

const TARGET = "0070_self_player_event_v2.sql";
const PRICES_GATE = /NOT NULL constraint failed: __gate_0070\.prices/;
const PAYMENTS_GATE =
	/NOT NULL constraint failed: __gate_0070\.payments_match_lines/;
const SELF_UNIQUE = /UNIQUE constraint failed: player\.user_id/;
const SELF_CHECK = /CHECK constraint failed: player_is_self_check/;
const beforeEntry = migrationFiles("0061_").map(statementsOf);
const cutovers = migrationFiles(TARGET)
	.filter((name) => name >= "0061_")
	.map(statementsOf);
const targetStatements = statementsOf(TARGET);
const directory = mkdtempSync(join(tmpdir(), "sapphire2-migration-0070-"));
const seededPath = join(directory, "seeded.sqlite");
let index = 0;

const day = Date.parse("2026-10-08T00:00:00Z") / 1000;
const live = day + 10 * 3600;

const SEED = `
INSERT INTO user (id, name, email) VALUES
 ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');
INSERT INTO player (id, user_id, name, updated_at) VALUES ('villain', 'alice', 'Villain', 2);
INSERT INTO room (id, user_id, name, updated_at) VALUES ('room', 'alice', 'Club', 2);
INSERT INTO asset (id, user_id, name, updated_at) VALUES ('jpy', 'alice', 'JPY', 2);
INSERT INTO tournament (id, user_id, room_id, name, variant, buy_in, entry_fee, starting_stack, table_size, currency_id, created_at, updated_at) VALUES
 ('mtt', 'alice', 'room', 'Main', 'NL Hold''em', 1000, 100, 5000, 9, 'jpy', 1, 2);
INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips, sort_order) VALUES
 ('m-addon', 'mtt', 'Add-on', 500, 5000, 0), ('m-bonus', 'mtt', 'Bonus', 0, 8000, 1);
INSERT INTO game_session (id, user_id, kind, source, status, session_date, started_at, ended_at, break_minutes, currency_id, created_at, updated_at) VALUES
 ('c-live', 'alice', 'cash_game', 'live', 'completed', ${day}, ${live}, ${live + 600}, 0, 'jpy', 1, 2),
 ('t-live', 'alice', 'tournament', 'live', 'completed', ${day}, ${live}, ${live + 600}, 0, 'jpy', 3, 4);
INSERT INTO session_cash_detail (session_id, buy_in, cash_out, chip_remove_total, variant, blind1, blind2) VALUES
 ('c-live', 150, 150, 20, 'NL Hold''em', 1, 2);
INSERT INTO session_tournament_detail (session_id, tournament_id, tournament_buy_in, entry_fee, placement, total_entries, prize_money, bounty_prizes, variant, starting_stack, table_size) VALUES
 ('t-live', 'mtt', 1000, 100, 4, 10, 300, 50, 'NL Hold''em', 5000, 9);
INSERT INTO session_chip_purchase (id, session_id, name, cost, chips, sort_order) VALUES
 ('tl-addon', 't-live', 'Add-on', 500, 5000, 0), ('tl-bonus', 't-live', 'Bonus', 0, 8000, 1);
INSERT INTO session_chip_purchase_result (session_chip_purchase_id, count) VALUES ('tl-addon', 1), ('tl-bonus', 1);
INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES
 ('c-start', 'c-live', 'session_start', ${live}, 0, '{"buyInAmount":100}', 11, 12),
 ('c-hero-join', 'c-live', 'player_join', ${live + 60}, 1, '{"isHero":true,"seatPosition":3}', 13, 14),
 ('c-villain-join', 'c-live', 'player_join', ${live + 60}, 2, '{"playerId":"villain","seatPosition":5}', 15, 16),
 ('c-orphan-join', 'c-live', 'player_join', ${live + 60}, 3, '{}', 17, 18),
 ('c-add', 'c-live', 'chips_add_remove', ${live + 120}, 4, '{"amount":50}', 19, 20),
 ('c-remove', 'c-live', 'chips_add_remove', ${live + 180}, 5, '{"amount":-20}', 21, 22),
 ('c-pause', 'c-live', 'session_pause', ${live + 240}, 6, '{}', 23, 24),
 ('c-resume', 'c-live', 'session_resume', ${live + 300}, 7, '{}', 25, 26),
 ('c-memo', 'c-live', 'memo', ${live + 300}, 8, '{"text":"tilt"}', 27, 28),
 ('c-hero-leave', 'c-live', 'player_leave', ${live + 500}, 9, '{"isHero":true}', 29, 30),
 ('c-villain-leave', 'c-live', 'player_leave', ${live + 500}, 10, '{"playerId":"villain"}', 31, 32),
 ('c-orphan-leave', 'c-live', 'player_leave', ${live + 500}, 11, '{}', 33, 34),
 ('c-end', 'c-live', 'session_end', ${live + 600}, 12, '{"cashOutAmount":150}', 35, 36),
 ('t-start', 't-live', 'session_start', ${live}, 0, '{"timerStartedAt":${live}}', 41, 42),
 ('t-addon', 't-live', 'purchase_chips', ${live + 60}, 1, '{"sessionChipPurchaseId":"tl-addon","name":"Add-on","cost":500,"chips":5000}', 43, 44),
 ('t-bonus', 't-live', 'purchase_chips', ${live + 120}, 2, '{"sessionChipPurchaseId":"tl-bonus","name":"Bonus","cost":0,"chips":8000}', 45, 46),
 ('t-stack', 't-live', 'update_stack', ${live + 180}, 3, '{"stackAmount":9000,"remainingPlayers":5,"totalEntries":10,"chipPurchaseCounts":[{"name":"Add-on","count":1,"chipsPerUnit":5000}]}', 47, 48),
 ('t-end', 't-live', 'session_end', ${live + 600}, 4, '{"beforeDeadline":false,"placement":4,"totalEntries":10,"prizeMoney":300,"bountyPrizes":50}', 49, 50);
`;

const IDENTITY =
	"SELECT id, user_id, entry_id, entry_source, play_session_id, type, occurred_at, sort_order, hand_id, created_at, updated_at FROM play_event ORDER BY id";
const ORPHANS = ["c-orphan-join", "c-orphan-leave"];

function apply(db: Database, statements = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function values(db: Database, sql: string) {
	return rowValues(db.prepare(sql));
}

function payload(db: Database, id: string): unknown {
	const [row] = values(db, `SELECT payload FROM play_event WHERE id = '${id}'`);
	return JSON.parse(stringValue(row?.[0]));
}

describe("migration 0070 — self player and play event payload v2", () => {
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
	afterAll(() => rmSync(directory, { recursive: true, force: true }));
	beforeEach(() => {
		const path = join(directory, `${index++}.sqlite`);
		copyFileSync(seededPath, path);
		db = openDatabase(path);
		db.exec(
			"PRAGMA journal_mode=MEMORY; PRAGMA synchronous=OFF; PRAGMA foreign_keys=ON"
		);
	});
	afterEach(() => db?.close());

	it("gives every user exactly one Hero self player and the schema allows no second one", () => {
		apply(db);
		expect(
			values(
				db,
				"SELECT id, user_id, name, is_temporary FROM player WHERE is_self = 1 ORDER BY user_id"
			)
		).toEqual([
			["self:alice", "alice", "Hero", 0],
			["self:bob", "bob", "Hero", 0],
		]);
		expect(() =>
			db.exec(
				"INSERT INTO player (id, user_id, name, is_self, updated_at) VALUES ('again', 'alice', 'Me', 1, 2)"
			)
		).toThrow(SELF_UNIQUE);
		expect(() =>
			db.exec(
				"INSERT INTO player (id, user_id, name, is_self, updated_at) VALUES ('two', 'alice', 'Me', 2, 2)"
			)
		).toThrow(SELF_CHECK);
	});

	it("keeps every event's identity and order, drops only orphan player events and leaves ledger lines alone", () => {
		const identity = values(db, IDENTITY);
		const ledger = values(db, "SELECT * FROM ledger_line ORDER BY id");
		apply(db);
		expect(values(db, IDENTITY)).toEqual(
			identity.filter((row) => !ORPHANS.includes(stringValue(row[0])))
		);
		expect(values(db, "SELECT * FROM ledger_line ORDER BY id")).toEqual(ledger);
		expect(
			values(db, "SELECT DISTINCT schema_version FROM play_event")
		).toEqual([[2]]);
		for (const [kind, type, json] of values(
			db,
			"SELECT e.kind, pe.type, pe.payload FROM play_event pe JOIN entry e ON e.id = pe.entry_id"
		)) {
			const schema = playEventPayloadSchema(
				stringValue(kind) as EntryKind,
				stringValue(type)
			);
			expect(schema?.safeParse(JSON.parse(stringValue(json))).success).toBe(
				true
			);
		}
		expect(values(db, "PRAGMA foreign_key_check")).toEqual([]);
	});

	it("names Hero by the owner's self player and keeps other players", () => {
		apply(db);
		expect(payload(db, "c-hero-join")).toEqual({
			playerId: "self:alice",
			seatPosition: 3,
		});
		expect(payload(db, "c-hero-leave")).toEqual({ playerId: "self:alice" });
		expect(payload(db, "c-villain-join")).toEqual({
			playerId: "villain",
			seatPosition: 5,
		});
		expect(payload(db, "c-villain-leave")).toEqual({ playerId: "villain" });
	});

	it("copies payments from the event's own ledger lines, prices included", () => {
		apply(db);
		expect(payload(db, "c-start")).toEqual({
			payments: [
				{ assetId: "jpy", quantity: 100, role: "buy_in", effect: "real" },
			],
		});
		expect(payload(db, "c-add")).toEqual({
			amount: 50,
			assetId: "jpy",
			effect: "real",
		});
		expect(payload(db, "c-remove")).toEqual({
			amount: -20,
			assetId: "jpy",
			effect: "real",
		});
		expect(payload(db, "c-end")).toEqual({
			payments: [
				{ assetId: "jpy", quantity: 150, role: "cash_out", effect: "real" },
			],
		});
		expect(payload(db, "t-start")).toEqual({
			timerStartedAt: live,
			payments: [
				{
					assetId: "jpy",
					quantity: 1000,
					role: "buy_in",
					effect: "real",
					priceId: "trp:tr:mtt:entry",
				},
				{
					assetId: "jpy",
					quantity: 100,
					role: "fee",
					effect: "real",
					priceId: "trp:tr:mtt:entry",
				},
			],
		});
		expect(payload(db, "t-addon")).toEqual({
			priceId: "trp:m-addon",
			label: "Add-on",
			chips: 5000,
			payments: [
				{
					assetId: "jpy",
					quantity: 500,
					role: "chip_purchase",
					effect: "real",
					priceId: "trp:m-addon",
				},
			],
		});
		expect(payload(db, "t-end")).toEqual({
			beforeDeadline: false,
			placement: 4,
			totalEntries: 10,
			payments: [
				{ assetId: "jpy", quantity: 300, role: "prize", effect: "real" },
				{ assetId: "jpy", quantity: 50, role: "bounty", effect: "real" },
			],
		});
		expect(payload(db, "t-stack")).toEqual({
			stackAmount: 9000,
			remainingPlayers: 5,
			totalEntries: 10,
			chipPurchaseCounts: [{ name: "Add-on", count: 1, chipsPerUnit: 5000 }],
		});
	});

	it("prices a zero-cost purchase without a line by its snapshot position", () => {
		apply(db);
		expect(payload(db, "t-bonus")).toEqual({
			priceId: "trp:m-bonus",
			label: "Bonus",
			chips: 8000,
			payments: [],
		});
	});

	it("stops when a purchase line has lost its price", () => {
		db.exec("UPDATE ledger_line SET price_id = NULL WHERE id = 't-addon:0'");
		expect(() => apply(db)).toThrow(PRICES_GATE);
	});

	it("stops when a chips add/remove event has no line to take its asset from", () => {
		db.exec("DELETE FROM ledger_line WHERE id = 'c-add:0'");
		expect(() => apply(db)).toThrow(PAYMENTS_GATE);
	});
});
