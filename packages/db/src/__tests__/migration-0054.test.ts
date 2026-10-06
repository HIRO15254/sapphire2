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
const EXPAND_MIGRATION_PATTERN = /^005[45]_/;
const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;
const migrationFiles = readdirSync(migrationsDirectory)
	.filter((name) => MIGRATION_FILE_PATTERN.test(name))
	.toSorted();
const masterTables = [
	"tournament",
	"ring_game",
	"player_tag",
	"player",
	"currency",
	"room",
] as const;

function applyMigration(db: any, name: string) {
	const sql = readFileSync(join(migrationsDirectory, name), "utf8");
	for (const statement of sql.split("--> statement-breakpoint")) {
		const trimmed = statement.trim();
		if (trimmed && !trimmed.startsWith("PRAGMA foreign_keys=")) {
			db.exec(trimmed);
		}
	}
}

skipIfNotBun("0054/0055 owned-master expand migrations", () => {
	let db: any;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec("PRAGMA foreign_keys=ON");
		for (const name of migrationFiles.filter((name) => name < "0054_")) {
			applyMigration(db, name);
		}
		db.exec(`
			INSERT INTO user (id, name, email, updated_at)
			VALUES ('alice', 'Alice', 'alice@example.test', 1), ('bob', 'Bob', 'bob@example.test', 1);
			INSERT INTO room (id, user_id, name, updated_at) VALUES ('room', 'alice', 'Club', 1);
			INSERT INTO currency (id, user_id, name, updated_at) VALUES ('currency', 'alice', 'Wallet', 1);
			INSERT INTO player (id, user_id, name, updated_at) VALUES ('player', 'alice', 'Player', 1);
			INSERT INTO player_tag (id, user_id, name, updated_at) VALUES ('player_tag', 'alice', 'Tag', 1);
			INSERT INTO player_to_player_tag (player_id, player_tag_id) VALUES ('player', 'player_tag');
			INSERT INTO tournament (id, room_id, currency_id, name, updated_at)
			VALUES ('tournament', 'room', 'currency', 'Daily', 1);
			INSERT INTO blind_level (id, tournament_id, level) VALUES ('level', 'tournament', 1);
			INSERT INTO tournament_chip_purchase (id, tournament_id, name, cost, chips)
			VALUES ('purchase', 'tournament', 'Rebuy', 100, 1000);
			INSERT INTO tournament_tag (id, tournament_id, name) VALUES ('tag', 'tournament', 'Daily');
			INSERT INTO ring_game (id, user_id, room_id, name, updated_at)
			VALUES ('ring_game', 'alice', 'room', 'Cash', 1), ('legacy-ring', NULL, 'room', 'Legacy', 1);
		`);
	});

	afterEach(() => db?.close());

	it("preserves populated masters and children with FKs enabled and leaves legacy ownership unbackfilled", () => {
		const tables = [
			...masterTables,
			"blind_level",
			"tournament_chip_purchase",
			"tournament_tag",
			"player_to_player_tag",
		];
		const before = tables.map((table) =>
			db.prepare(`SELECT * FROM ${table}`).all()
		);
		for (const name of migrationFiles.filter((name) =>
			EXPAND_MIGRATION_PATTERN.test(name)
		)) {
			applyMigration(db, name);
		}
		for (const [index, table] of tables.entries()) {
			const expected =
				table === "tournament"
					? before[index].map((row: object) => ({ ...row, user_id: null }))
					: before[index];
			expect(db.prepare(`SELECT * FROM ${table}`).all()).toEqual(expected);
		}
		expect(db.query("PRAGMA foreign_keys").values()).toEqual([[1]]);
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});

	it("supports same-owner composite child references and cascading parent deletes for all six masters", () => {
		for (const name of migrationFiles.filter((name) =>
			EXPAND_MIGRATION_PATTERN.test(name)
		)) {
			applyMigration(db, name);
		}
		db.exec("UPDATE tournament SET user_id = 'alice' WHERE id = 'tournament'");
		for (const table of masterTables) {
			db.exec(`CREATE TABLE child_${table} (
				parent_id TEXT, user_id TEXT,
				FOREIGN KEY (parent_id, user_id) REFERENCES ${table}(id, user_id) ON DELETE CASCADE
			)`);
			expect(() =>
				db.query(`INSERT INTO child_${table} VALUES (?, ?)`).run(table, "bob")
			).toThrow(FOREIGN_KEY_VIOLATION);
			db.query(`INSERT INTO child_${table} VALUES (?, ?)`).run(table, "alice");
			db.query(`DELETE FROM ${table} WHERE id = ?`).run(table);
			expect(db.query(`SELECT * FROM child_${table}`).all()).toEqual([]);
		}
		expect(db.query("PRAGMA foreign_key_check").values()).toEqual([]);
	});
});
