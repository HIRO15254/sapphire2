import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionEvent } from "../schema/session-event";

describe("SessionEvent schema — columns", () => {
	const columns = getTableColumns(sessionEvent);

	it("has required columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"sessionId",
				"eventType",
				"occurredAt",
				"sortOrder",
				"payload",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is not null (single FK, not nullable)", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("eventType, occurredAt, sortOrder, payload are not null", () => {
		expect(columns.eventType.notNull).toBe(true);
		expect(columns.occurredAt.notNull).toBe(true);
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.payload.notNull).toBe(true);
	});

	it("does NOT have liveCashGameSessionId column (old dual-FK removed)", () => {
		expect(
			(columns as Record<string, unknown>).liveCashGameSessionId
		).toBeUndefined();
	});

	it("does NOT have liveTournamentSessionId column (old dual-FK removed)", () => {
		expect(
			(columns as Record<string, unknown>).liveTournamentSessionId
		).toBeUndefined();
	});
});

describe("SessionEvent — FK cascade policies", () => {
	const config = getTableConfig(sessionEvent);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (events die with the session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has exactly 1 foreign key (unified sessionId)", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("SessionEvent — indexes", () => {
	const config = getTableConfig(sessionEvent);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has sessionId index for per-session event fetch", () => {
		expect(idxNames).toContain("sessionEvent_sessionId_idx");
	});

	it("has eventType index to filter by event kind", () => {
		expect(idxNames).toContain("sessionEvent_eventType_idx");
	});

	it("does NOT have old dual-FK indexes", () => {
		expect(idxNames).not.toContain("sessionEvent_liveCashGameSessionId_idx");
		expect(idxNames).not.toContain("sessionEvent_liveTournamentSessionId_idx");
	});

	it("has no unique indexes (multiple events per session allowed)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("SessionEvent — defaults and column types", () => {
	const columns = getTableColumns(sessionEvent);

	it("createdAt has a default (unixepoch)", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("createdAt and updatedAt are not null", () => {
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.updatedAt.notNull).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("occurredAt uses timestamp mode", () => {
		expect(columns.occurredAt.dataType).toBe("date");
	});

	it("eventType / payload are stored as strings", () => {
		expect(columns.eventType.dataType).toBe("string");
		expect(columns.payload.dataType).toBe("string");
	});

	it("sortOrder is an integer used for stable ordering", () => {
		expect(columns.sortOrder.dataType).toBe("number");
		expect(columns.sortOrder.notNull).toBe(true);
	});
});
