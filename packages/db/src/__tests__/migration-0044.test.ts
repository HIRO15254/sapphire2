import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// bun:sqlite is only available in Bun runtime, skip this test in Node.js
// biome-ignore lint/correctness/noUndeclaredVariables: Bun global is only present in Bun runtime
const isBun = typeof Bun !== "undefined";
const skipIfNotBun = isBun ? describe : describe.skip;

let Database: any = null;
if (isBun) {
	// eslint-disable-next-line import/no-unresolved
	const bunSqlite = require("bun:sqlite");
	Database = bunSqlite.Database;
}

const migrationPath = fileURLToPath(
	new URL("../migrations/0044_oval_captain_flint.sql", import.meta.url)
);
const migrationSql = readFileSync(migrationPath, "utf8");

const baseSchema =
	"CREATE TABLE game_session (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, session_date INTEGER NOT NULL);";
const UNIQUE_USER_CONFLICT_RE =
	/UNIQUE constraint failed: game_session\.user_id/;

skipIfNotBun("migration 0044 — one unfinished live session per user", () => {
	let db: any;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec(baseSchema);
	});

	afterEach(() => {
		db?.close();
	});

	it("creates the expected partial unique index", () => {
		db.exec(migrationSql);

		const index = db
			.query(
				"SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = ?"
			)
			.get("session_one_unfinished_live_per_user_idx") as {
			name: string;
			sql: string;
		};
		expect(index.name).toBe("session_one_unfinished_live_per_user_idx");
		expect(index.sql).toContain("UNIQUE INDEX");
		expect(index.sql).toContain(
			'WHERE "game_session"."source" = \'live\' AND "game_session"."status" != \'completed\''
		);
	});

	it("blocks active and paused sessions across cash and tournament kinds", () => {
		db.exec(migrationSql);
		db.exec(
			"INSERT INTO game_session VALUES ('cash-1', 'user-1', 'cash_game', 'active', 'live', 1)"
		);

		expect(() =>
			db.exec(
				"INSERT INTO game_session VALUES ('tournament-1', 'user-1', 'tournament', 'paused', 'live', 1)"
			)
		).toThrow(UNIQUE_USER_CONFLICT_RE);
	});

	it("allows completed sessions, manual sessions, and unfinished sessions for other users", () => {
		db.exec(migrationSql);
		db.exec(
			"INSERT INTO game_session VALUES ('live-1', 'user-1', 'cash_game', 'active', 'live', 1)"
		);

		expect(() =>
			db.exec(
				"INSERT INTO game_session VALUES ('completed-1', 'user-1', 'tournament', 'completed', 'live', 1)"
			)
		).not.toThrow();
		expect(() =>
			db.exec(
				"INSERT INTO game_session VALUES ('manual-1', 'user-1', 'cash_game', 'active', 'manual', 1)"
			)
		).not.toThrow();
		expect(() =>
			db.exec(
				"INSERT INTO game_session VALUES ('live-2', 'user-2', 'tournament', 'paused', 'live', 1)"
			)
		).not.toThrow();
	});

	it("releases the slot when the existing live session is completed", () => {
		db.exec(migrationSql);
		db.exec(
			"INSERT INTO game_session VALUES ('cash-1', 'user-1', 'cash_game', 'active', 'live', 1)"
		);
		db.exec("UPDATE game_session SET status = 'completed' WHERE id = 'cash-1'");

		expect(() =>
			db.exec(
				"INSERT INTO game_session VALUES ('tournament-1', 'user-1', 'tournament', 'active', 'live', 1)"
			)
		).not.toThrow();
	});

	it("blocks reopening a completed session while another live session owns the slot", () => {
		db.exec(migrationSql);
		db.exec(
			"INSERT INTO game_session VALUES ('completed-1', 'user-1', 'cash_game', 'completed', 'live', 1)"
		);
		db.exec(
			"INSERT INTO game_session VALUES ('active-1', 'user-1', 'tournament', 'active', 'live', 1)"
		);

		expect(() =>
			db.exec(
				"UPDATE game_session SET status = 'active' WHERE id = 'completed-1'"
			)
		).toThrow(UNIQUE_USER_CONFLICT_RE);
		expect(
			db
				.query("SELECT status FROM game_session WHERE id = ?")
				.get("completed-1")
		).toEqual({ status: "completed" });
	});

	it("fails migration instead of silently rewriting pre-existing duplicates", () => {
		db.exec(
			"INSERT INTO game_session VALUES ('cash-1', 'user-1', 'cash_game', 'active', 'live', 1)"
		);
		db.exec(
			"INSERT INTO game_session VALUES ('tournament-1', 'user-1', 'tournament', 'paused', 'live', 1)"
		);

		expect(() => db.exec(migrationSql)).toThrow(UNIQUE_USER_CONFLICT_RE);
	});
});
