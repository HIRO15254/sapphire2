import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// biome-ignore lint/correctness/noUndeclaredVariables: Bun global is only present in Bun runtime
const isBun = typeof Bun !== "undefined";
const skipIfNotBun = isBun ? describe : describe.skip;

let Database: any = null;
if (isBun) {
	const bunSqlite = require("bun:sqlite");
	Database = bunSqlite.Database;
}

const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);
const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;
const TARGET_MIGRATION = "0054_stale_redwing.sql";
const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;
const NOT_NULL_VIOLATION = /NOT NULL constraint failed/;

function statementsOf(name: string): string[] {
	return readFileSync(join(migrationsDirectory, name), "utf8")
		.split("--> statement-breakpoint")
		.map((statement) => statement.trim())
		.filter(
			(statement) => statement && !statement.startsWith("PRAGMA foreign_keys=")
		);
}

const earlierMigrations = readdirSync(migrationsDirectory)
	.filter((name) => MIGRATION_FILE_PATTERN.test(name) && name < "0054_")
	.toSorted()
	.map(statementsOf);
const targetStatements = statementsOf(TARGET_MIGRATION);

const ROOM_OWNERS: Record<string, string> = {
	"alice-room": "alice",
	"bob-room": "bob",
};

const SEED = `
	INSERT INTO user (id, name, email) VALUES
		('alice', 'Alice', 'alice@example.test'),
		('bob', 'Bob', 'bob@example.test');
	INSERT INTO room (id, user_id, name, updated_at) VALUES
		('alice-room', 'alice', 'Club', 1),
		('bob-room', 'bob', 'Bar', 1);
	INSERT INTO currency (id, user_id, name, updated_at) VALUES ('chips', 'alice', 'Chips', 1);
	INSERT INTO tournament (id, room_id, currency_id, name, buy_in, created_at, updated_at) VALUES
		('daily', 'alice-room', 'chips', 'Daily', 100, 1, 1),
		('weekly', 'bob-room', NULL, 'Weekly', 500, 1, 1);
	INSERT INTO blind_level (id, tournament_id, level, blind1, blind2) VALUES ('level', 'daily', 1, 100, 200);
	INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips) VALUES ('rebuy', 'daily', 'Rebuy', 100, 1000);
	INSERT INTO tournament_tag (id, tournament_id, name, created_at) VALUES ('turbo', 'daily', 'Turbo', 1);
	INSERT INTO ring_game (id, user_id, room_id, currency_id, name, blind2, created_at, updated_at) VALUES
		('owned', 'alice', 'alice-room', 'chips', 'Owned', 200, 1, 1),
		('room-only', NULL, 'alice-room', NULL, 'Room only', 200, 1, 1),
		('session-only', NULL, NULL, NULL, 'Session only', 200, 1, 1),
		('unused', NULL, NULL, NULL, 'Unused', 200, 1, 1),
		('cross-room', 'alice', 'bob-room', NULL, 'Cross room', 200, 1, 1);
	INSERT INTO game_session (id, user_id, kind, status, source, session_date, updated_at) VALUES
		('cash-owned', 'alice', 'cash_game', 'completed', 'manual', 1, 1),
		('cash-roomless', 'bob', 'cash_game', 'completed', 'manual', 1, 1),
		('cash-unlinked', 'alice', 'cash_game', 'completed', 'manual', 1, 1),
		('mtt', 'alice', 'tournament', 'completed', 'manual', 1, 1);
	INSERT INTO session_cash_detail (session_id, ring_game_id, buy_in) VALUES
		('cash-owned', 'owned', 100),
		('cash-roomless', 'session-only', 100),
		('cash-unlinked', NULL, 100);
	INSERT INTO session_tournament_detail (session_id, tournament_id, placement) VALUES ('mtt', 'daily', 3);
`;

const SNAPSHOT_QUERIES = {
	tournament: "SELECT * FROM tournament ORDER BY id",
	ringGame: "SELECT * FROM ring_game ORDER BY id",
	blindLevel: "SELECT * FROM blind_level ORDER BY id",
	chipPurchase: "SELECT * FROM tournament_chip_purchase ORDER BY id",
	tournamentTag: "SELECT * FROM tournament_tag ORDER BY id",
	cashLinks:
		"SELECT session_id, ring_game_id, buy_in FROM session_cash_detail ORDER BY session_id",
	tournamentLinks:
		"SELECT session_id, tournament_id, placement FROM session_tournament_detail ORDER BY session_id",
} as const;

type Snapshot = Record<keyof typeof SNAPSHOT_QUERIES, any[]>;

function snapshot(db: any): Snapshot {
	return Object.fromEntries(
		Object.entries(SNAPSHOT_QUERIES).map(([key, sql]) => [
			key,
			db.prepare(sql).all(),
		])
	) as Snapshot;
}

const LEGACY_RING_GAME_FIXES: Record<string, object> = {
	"cross-room": { room_id: null },
	"room-only": { user_id: "alice" },
	"session-only": { user_id: "bob" },
};

function expectedAfterMigration(before: Snapshot): Snapshot {
	return {
		...before,
		tournament: before.tournament.map((row) => ({
			...row,
			user_id: ROOM_OWNERS[row.room_id],
		})),
		ringGame: before.ringGame
			.filter((row) => row.id !== "unused")
			.map((row) => ({ ...row, ...LEGACY_RING_GAME_FIXES[row.id] })),
	};
}

let seededImage: Uint8Array | null = null;

function migratedDatabase(): any {
	if (!seededImage) {
		const seeded = new Database(":memory:");
		seeded.exec("PRAGMA foreign_keys=ON");
		for (const statements of earlierMigrations) {
			for (const statement of statements) {
				seeded.exec(statement);
			}
		}
		seeded.exec(SEED);
		seededImage = seeded.serialize();
		seeded.close();
	}
	const db = Database.deserialize(seededImage);
	db.exec("PRAGMA foreign_keys=ON");
	return db;
}

function apply(db: any, statements: string[] = targetStatements): void {
	for (const statement of statements) {
		db.exec(statement);
	}
}

function statementsBefore(prefix: string): string[] {
	const index = targetStatements.findIndex((statement) =>
		statement.startsWith(prefix)
	);
	if (index < 0) {
		throw new Error(`no migration statement starts with ${prefix}`);
	}
	return targetStatements.slice(0, index);
}

function stageTables(db: any): string[] {
	return db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '__stage_0054_%'"
		)
		.all();
}

skipIfNotBun("migration 0054 — owned ring_game / tournament rebuild", () => {
	let db: any;

	beforeEach(() => {
		db = migratedDatabase();
	});

	afterEach(() => db?.close());

	it("fills tournament.user_id from its room and keeps every child row and session link", () => {
		const before = snapshot(db);
		apply(db);
		expect(snapshot(db)).toEqual(expectedAfterMigration(before));
		expect(stageTables(db)).toEqual([]);
		expect(db.prepare("PRAGMA foreign_keys").values()).toEqual([[1]]);
		expect(db.prepare("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("resolves each ring game's owner and drops only the ones no one owns or links", () => {
		apply(db);
		expect(
			db.prepare("SELECT id, user_id, room_id FROM ring_game ORDER BY id").all()
		).toEqual([
			{ id: "cross-room", user_id: "alice", room_id: null },
			{ id: "owned", user_id: "alice", room_id: "alice-room" },
			{ id: "room-only", user_id: "alice", room_id: "alice-room" },
			{ id: "session-only", user_id: "bob", room_id: null },
		]);
	});

	it("rejects masters without an owner or in another owner's room, and cascades room deletes", () => {
		apply(db);
		expect(() =>
			db.exec(
				"INSERT INTO tournament (id, room_id, name, updated_at) VALUES ('no-owner', 'alice-room', 'X', 1)"
			)
		).toThrow(NOT_NULL_VIOLATION);
		expect(() =>
			db.exec(
				"INSERT INTO ring_game (id, name, updated_at) VALUES ('no-owner', 'X', 1)"
			)
		).toThrow(NOT_NULL_VIOLATION);
		expect(() =>
			db.exec(
				"INSERT INTO tournament (id, user_id, room_id, name, updated_at) VALUES ('foreign', 'bob', 'alice-room', 'X', 1)"
			)
		).toThrow(FOREIGN_KEY_VIOLATION);
		expect(() =>
			db.exec(
				"INSERT INTO ring_game (id, user_id, room_id, name, updated_at) VALUES ('foreign', 'bob', 'alice-room', 'X', 1)"
			)
		).toThrow(FOREIGN_KEY_VIOLATION);
		db.exec(
			"INSERT INTO ring_game (id, user_id, name, updated_at) VALUES ('roomless', 'bob', 'X', 1)"
		);

		db.exec("DELETE FROM room WHERE id = 'alice-room'");

		expect(db.prepare("SELECT id FROM tournament").all()).toEqual([
			{ id: "weekly" },
		]);
		expect(db.prepare("SELECT id FROM ring_game ORDER BY id").all()).toEqual([
			{ id: "cross-room" },
			{ id: "roomless" },
			{ id: "session-only" },
		]);
		expect(db.prepare("SELECT COUNT(*) AS n FROM blind_level").get()).toEqual({
			n: 0,
		});
		expect(snapshot(db).cashLinks).toEqual([
			{ session_id: "cash-owned", ring_game_id: null, buy_in: 100 },
			{
				session_id: "cash-roomless",
				ring_game_id: "session-only",
				buy_in: 100,
			},
			{ session_id: "cash-unlinked", ring_game_id: null, buy_in: 100 },
		]);
		expect(snapshot(db).tournamentLinks).toEqual([
			{ session_id: "mtt", tournament_id: null, placement: 3 },
		]);
	});

	it("lets children reference all six owned masters by (id, user_id)", () => {
		apply(db);
		db.exec(`
			INSERT INTO player (id, user_id, name, updated_at) VALUES ('player', 'alice', 'Villain', 1);
			INSERT INTO player_tag (id, user_id, name, updated_at) VALUES ('player_tag', 'alice', 'Fish', 1);
		`);
		const parents = {
			room: "alice-room",
			currency: "chips",
			player: "player",
			player_tag: "player_tag",
			ring_game: "owned",
			tournament: "daily",
		};
		for (const [table, id] of Object.entries(parents)) {
			db.exec(`CREATE TABLE child_${table} (
				parent_id TEXT, user_id TEXT,
				FOREIGN KEY (parent_id, user_id) REFERENCES ${table}(id, user_id) ON DELETE CASCADE
			)`);
			expect(() =>
				db.prepare(`INSERT INTO child_${table} VALUES (?, 'bob')`).run(id)
			).toThrow(FOREIGN_KEY_VIOLATION);
			db.prepare(`INSERT INTO child_${table} VALUES (?, 'alice')`).run(id);
		}
		db.exec("DELETE FROM user WHERE id = 'alice'");
		for (const table of Object.keys(parents)) {
			expect(db.prepare(`SELECT * FROM child_${table}`).all()).toEqual([]);
		}
		expect(db.prepare("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("reaches the same result when the retry follows a failure at any statement", () => {
		const expected = expectedAfterMigration(snapshot(db));
		for (let failedAt = 1; failedAt < targetStatements.length; failedAt++) {
			const partial = migratedDatabase();
			try {
				apply(partial, targetStatements.slice(0, failedAt));
				apply(partial);
				expect(
					{ failedAt, result: snapshot(partial) },
					targetStatements[failedAt]
				).toEqual({ failedAt, result: expected });
				expect(stageTables(partial)).toEqual([]);
				expect(partial.prepare("PRAGMA foreign_key_check").values()).toEqual(
					[]
				);
			} finally {
				partial.close();
			}
		}
	});

	it("keeps rows the old Worker wrote between a failure before the drop and the retry", () => {
		apply(db, statementsBefore("DROP TABLE IF EXISTS `ring_game`"));
		db.exec(`
			INSERT INTO tournament (id, room_id, name, updated_at) VALUES ('late', 'bob-room', 'Late', 2);
			INSERT INTO blind_level (id, tournament_id, level) VALUES ('late-level', 'late', 1);
			INSERT INTO tournament_tag (id, tournament_id, name) VALUES ('late-tag', 'daily', 'Late');
			INSERT INTO ring_game (id, user_id, room_id, name, updated_at) VALUES ('late-ring', 'alice', 'alice-room', 'Late', 2);
			UPDATE session_cash_detail SET ring_game_id = 'late-ring' WHERE session_id = 'cash-unlinked';
		`);
		const before = snapshot(db);

		apply(db);

		expect(snapshot(db)).toEqual(expectedAfterMigration(before));
		expect(
			db.prepare("SELECT user_id FROM tournament WHERE id = 'late'").get()
		).toEqual({ user_id: "bob" });
		expect(
			db
				.prepare(
					"SELECT ring_game_id FROM session_cash_detail WHERE session_id = 'cash-unlinked'"
				)
				.get()
		).toEqual({ ring_game_id: "late-ring" });
	});

	it("keeps ring_game writes the old Worker made after the ring_game rebuild finished", () => {
		const expected = expectedAfterMigration(snapshot(db));
		apply(db, statementsBefore("CREATE TABLE `tournament`"));
		db.exec(`
			INSERT INTO ring_game (id, user_id, room_id, name, updated_at) VALUES ('late-ring', 'alice', 'alice-room', 'Late', 2);
			UPDATE ring_game SET name = 'Renamed' WHERE id = 'owned';
			UPDATE session_cash_detail SET ring_game_id = 'late-ring' WHERE session_id = 'cash-unlinked';
		`);
		const ringGame = db.prepare(SNAPSHOT_QUERIES.ringGame).all();
		const cashLinks = db.prepare(SNAPSHOT_QUERIES.cashLinks).all();

		apply(db);

		expect(snapshot(db)).toEqual({ ...expected, ringGame, cashLinks });
		expect(ringGame).toContainEqual(
			expect.objectContaining({ id: "late-ring", user_id: "alice" })
		);
	});

	it("keeps writes the old Worker made after both rebuilds finished", () => {
		apply(
			db,
			statementsBefore("DROP TABLE IF EXISTS `__stage_0054_ring_game`")
		);
		db.exec(`
			UPDATE tournament SET name = 'Renamed' WHERE id = 'daily';
			DELETE FROM blind_level WHERE tournament_id = 'daily';
			INSERT INTO blind_level (id, tournament_id, level) VALUES ('replaced-level', 'daily', 1);
			INSERT INTO tournament_tag (id, tournament_id, name, created_at) VALUES ('late-tag', 'weekly', 'Late', 2);
			INSERT INTO game_session (id, user_id, kind, status, source, session_date, updated_at)
				VALUES ('late-mtt', 'bob', 'tournament', 'completed', 'manual', 2, 2);
			INSERT INTO session_tournament_detail (session_id, tournament_id) VALUES ('late-mtt', 'weekly');
			UPDATE ring_game SET name = 'Renamed' WHERE id = 'owned';
		`);
		const before = snapshot(db);

		apply(db);

		expect(snapshot(db)).toEqual(before);
		expect(before.blindLevel).toEqual([
			expect.objectContaining({ id: "replaced-level" }),
		]);
	});
});
