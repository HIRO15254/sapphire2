import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
	new URL("../migrations/0045_session_result_type_unique.sql", import.meta.url)
);
const migrationSql = readFileSync(migrationPath, "utf8");
const UNIQUE_USER_CONFLICT_RE =
	/UNIQUE constraint failed: transaction_type\.user_id/;

const baseSchema = [
	"CREATE TABLE transaction_type (",
	"  id TEXT PRIMARY KEY NOT NULL,",
	"  user_id TEXT NOT NULL,",
	"  name TEXT NOT NULL,",
	"  created_at INTEGER NOT NULL,",
	"  updated_at INTEGER NOT NULL",
	");",
	"CREATE TABLE currency_transaction (",
	"  id TEXT PRIMARY KEY NOT NULL,",
	"  transaction_type_id TEXT NOT NULL REFERENCES transaction_type(id)",
	");",
].join("\n");

function insertType(
	db: any,
	id: string,
	userId: string,
	name: string,
	createdAt: number
) {
	db.query(
		"INSERT INTO transaction_type (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
	).run(id, userId, name, createdAt, createdAt);
}

skipIfNotBun("migration 0045 — unique Session Result type per user", () => {
	let db: any;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec("PRAGMA foreign_keys = ON");
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
			.get("transactionType_sessionResultPerUser_idx") as {
			name: string;
			sql: string;
		};
		expect(index.name).toBe("transactionType_sessionResultPerUser_idx");
		expect(index.sql).toContain("UNIQUE INDEX");
		expect(index.sql).toContain("WHERE");
		expect(index.sql).toContain("name");
		expect(index.sql).toContain("'Session Result'");
	});

	it("keeps the oldest duplicate, repoints every ledger row, and deletes the rest", () => {
		insertType(db, "newer", "user-1", "Session Result", 20);
		insertType(db, "oldest", "user-1", "Session Result", 10);
		insertType(db, "middle", "user-1", "Session Result", 15);
		db.exec(
			"INSERT INTO currency_transaction VALUES ('tx-1', 'newer'), ('tx-2', 'oldest'), ('tx-3', 'middle')"
		);

		db.exec(migrationSql);

		expect(
			db.query("SELECT id FROM transaction_type ORDER BY id").all()
		).toEqual([{ id: "oldest" }]);
		expect(
			db
				.query(
					"SELECT id, transaction_type_id FROM currency_transaction ORDER BY id"
				)
				.all()
		).toEqual([
			{ id: "tx-1", transaction_type_id: "oldest" },
			{ id: "tx-2", transaction_type_id: "oldest" },
			{ id: "tx-3", transaction_type_id: "oldest" },
		]);
	});

	it("uses the lowest id as the deterministic tie-breaker", () => {
		insertType(db, "z-id", "user-1", "Session Result", 10);
		insertType(db, "a-id", "user-1", "Session Result", 10);

		db.exec(migrationSql);

		expect(db.query("SELECT id FROM transaction_type").all()).toEqual([
			{ id: "a-id" },
		]);
	});

	it("preserves duplicate custom names and differently-cased names", () => {
		insertType(db, "custom-1", "user-1", "Bonus", 1);
		insertType(db, "custom-2", "user-1", "Bonus", 2);
		insertType(db, "lower-1", "user-1", "session result", 3);
		insertType(db, "lower-2", "user-1", "session result", 4);

		db.exec(migrationSql);

		expect(
			db.query("SELECT COUNT(*) AS count FROM transaction_type").get()
		).toEqual({ count: 4 });
	});

	it("rejects a second exact reserved type for one user but allows another user", () => {
		db.exec(migrationSql);
		insertType(db, "first", "user-1", "Session Result", 1);

		expect(() =>
			insertType(db, "second", "user-1", "Session Result", 2)
		).toThrow(UNIQUE_USER_CONFLICT_RE);
		expect(() =>
			insertType(db, "other-user", "user-2", "Session Result", 2)
		).not.toThrow();
	});
});
