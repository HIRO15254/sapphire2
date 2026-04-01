import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessionTablePlayer } from "../schema/session-table-player";

describe("SessionTablePlayer schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.id).toBeDefined();
		expect(columns.playerId).toBeDefined();
		expect(columns.isActive).toBeDefined();
		expect(columns.joinedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.id.primary).toBe(true);
	});

	it("playerId is not null", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.playerId.notNull).toBe(true);
	});

	it("isActive is not null", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.isActive.notNull).toBe(true);
	});

	it("session reference columns are nullable", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.liveCashGameSessionId.notNull).toBe(false);
		expect(columns.liveTournamentSessionId.notNull).toBe(false);
	});

	it("leftAt is nullable", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.leftAt.notNull).toBe(false);
	});
});
