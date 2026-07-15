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
	new URL(
		"../migrations/0046_session_event_sort_order_unique.sql",
		import.meta.url
	)
);
const migrationSql = readFileSync(migrationPath, "utf8");
const UNIQUE_ORDER_CONFLICT_RE =
	/UNIQUE constraint failed: session_event\.session_id, session_event\.sort_order/;

const baseSchema = [
	"CREATE TABLE session_event (",
	"  id TEXT PRIMARY KEY NOT NULL,",
	"  session_id TEXT NOT NULL,",
	"  event_type TEXT NOT NULL,",
	"  occurred_at INTEGER NOT NULL,",
	"  sort_order INTEGER NOT NULL,",
	"  payload TEXT NOT NULL,",
	"  created_at INTEGER NOT NULL,",
	"  updated_at INTEGER NOT NULL",
	");",
	"CREATE INDEX sessionEvent_sessionId_idx ON session_event (session_id);",
	"CREATE INDEX sessionEvent_eventType_idx ON session_event (event_type);",
].join("\n");

function insertEvent(
	db: any,
	id: string,
	sessionId: string,
	occurredAt: number,
	sortOrder: number,
	createdAt: number
) {
	db.query(
		"INSERT INTO session_event VALUES (?, ?, 'memo', ?, ?, '{}', ?, ?)"
	).run(id, sessionId, occurredAt, sortOrder, createdAt, createdAt);
}

skipIfNotBun("migration 0046 — unique session event append order", () => {
	let db: any;

	beforeEach(() => {
		db = new Database(":memory:");
		db.exec(baseSchema);
	});

	afterEach(() => {
		db?.close();
	});

	it("reindexes each session by the existing stable display order", () => {
		insertEvent(db, "z-tie", "session-1", 100, 5, 20);
		insertEvent(db, "a-tie", "session-1", 100, 5, 20);
		insertEvent(db, "later-sort", "session-1", 100, 6, 10);
		insertEvent(db, "earlier-time", "session-1", 50, 99, 30);
		insertEvent(db, "only", "session-2", 200, 7, 40);

		db.exec(migrationSql);

		expect(
			db
				.query(
					"SELECT id, session_id, sort_order FROM session_event ORDER BY session_id, sort_order"
				)
				.all()
		).toEqual([
			{ id: "earlier-time", session_id: "session-1", sort_order: 0 },
			{ id: "a-tie", session_id: "session-1", sort_order: 1 },
			{ id: "z-tie", session_id: "session-1", sort_order: 2 },
			{ id: "later-sort", session_id: "session-1", sort_order: 3 },
			{ id: "only", session_id: "session-2", sort_order: 0 },
		]);
	});

	it("replaces the standalone session index with the composite unique index", () => {
		db.exec(migrationSql);
		const indexes = db
			.query(
				"SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_event' ORDER BY name"
			)
			.all();
		expect(indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "sessionEvent_eventType_idx" }),
				{
					name: "sessionEvent_sessionId_sortOrder_idx",
					sql: "CREATE UNIQUE INDEX `sessionEvent_sessionId_sortOrder_idx` ON `session_event` (`session_id`,`sort_order`)",
				},
			])
		);
		expect(indexes.map((index: { name: string }) => index.name)).not.toContain(
			"sessionEvent_sessionId_idx"
		);
	});

	it("rejects a duplicate order in one session but allows the same order in another", () => {
		db.exec(migrationSql);
		insertEvent(db, "first", "session-1", 1, 0, 1);
		expect(() => insertEvent(db, "duplicate", "session-1", 2, 0, 2)).toThrow(
			UNIQUE_ORDER_CONFLICT_RE
		);
		expect(() =>
			insertEvent(db, "other-session", "session-2", 2, 0, 2)
		).not.toThrow();
	});

	it("supports consecutive atomic max-plus-one appends", () => {
		db.exec(migrationSql);
		const append = db.query(
			"INSERT INTO session_event (id, session_id, event_type, occurred_at, sort_order, payload, created_at, updated_at) VALUES (?, ?, 'memo', ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM session_event WHERE session_id = ?), '{}', ?, ?)"
		);
		append.run("first", "session-1", 10, "session-1", 10, 10);
		append.run("second", "session-1", 10, "session-1", 10, 10);

		expect(
			db
				.query(
					"SELECT id, sort_order FROM session_event WHERE session_id = 'session-1' ORDER BY sort_order"
				)
				.all()
		).toEqual([
			{ id: "first", sort_order: 0 },
			{ id: "second", sort_order: 1 },
		]);
	});
});
