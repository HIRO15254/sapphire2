import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Database, openDatabase } from "./sqlite";

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
	db: Database,
	id: string,
	sessionId: string,
	occurredAt: number,
	sortOrder: number,
	createdAt: number
) {
	db.prepare(
		"INSERT INTO session_event VALUES (?, ?, 'memo', ?, ?, '{}', ?, ?)"
	).run(id, sessionId, occurredAt, sortOrder, createdAt, createdAt);
}

describe("migration 0046 — unique session event append order", () => {
	let db: Database;

	beforeEach(() => {
		db = openDatabase();
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
				.prepare(
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
});
