import { getTableColumns } from "drizzle-orm";
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
