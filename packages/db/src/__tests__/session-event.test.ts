import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionEvent } from "../schema/session-event";

describe("SessionEvent schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(sessionEvent);
		expect(columns.id).toBeDefined();
		expect(columns.eventType).toBeDefined();
		expect(columns.occurredAt).toBeDefined();
		expect(columns.sortOrder).toBeDefined();
		expect(columns.payload).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(sessionEvent);
		expect(columns.id.primary).toBe(true);
	});

	it("eventType, occurredAt, sortOrder, payload are not null", () => {
		const columns = getTableColumns(sessionEvent);
		expect(columns.eventType.notNull).toBe(true);
		expect(columns.occurredAt.notNull).toBe(true);
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.payload.notNull).toBe(true);
	});

	it("session reference columns are nullable", () => {
		const columns = getTableColumns(sessionEvent);
		expect(columns.liveCashGameSessionId.notNull).toBe(false);
		expect(columns.liveTournamentSessionId.notNull).toBe(false);
	});
});

describe("SessionEvent — FK cascade policies", () => {
	const config = getTableConfig(sessionEvent);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("liveCashGameSessionId FK cascades (events die with the cash session)", () => {
		expect(fkByColumn("live_cash_game_session_id")?.onDelete).toBe("cascade");
	});

	it("liveTournamentSessionId FK cascades (events die with the tournament session)", () => {
		expect(fkByColumn("live_tournament_session_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});
});

describe("SessionEvent — indexes", () => {
	const config = getTableConfig(sessionEvent);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has liveCashGameSessionId index for per-session event fetch", () => {
		expect(idxNames).toContain("sessionEvent_liveCashGameSessionId_idx");
	});

	it("has liveTournamentSessionId index", () => {
		expect(idxNames).toContain("sessionEvent_liveTournamentSessionId_idx");
	});

	it("has eventType index to filter by event kind", () => {
		expect(idxNames).toContain("sessionEvent_eventType_idx");
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

	it("eventType / payload are stored as strings (enum enforced at app layer)", () => {
		expect(columns.eventType.dataType).toBe("string");
		expect(columns.payload.dataType).toBe("string");
	});

	it("sortOrder is an integer used for stable ordering", () => {
		expect(columns.sortOrder.dataType).toBe("number");
		expect(columns.sortOrder.notNull).toBe(true);
	});
});
