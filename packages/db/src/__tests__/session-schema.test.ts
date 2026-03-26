import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { pokerSession } from "../schema/session";

describe("PokerSession schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.type).toBeDefined();
		expect(columns.sessionDate).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.userId.notNull).toBe(true);
	});

	it("type is not null", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.type.notNull).toBe(true);
	});

	it("sessionDate is not null", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.sessionDate.notNull).toBe(true);
	});

	it("optional columns are nullable", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.storeId.notNull).toBe(false);
		expect(columns.ringGameId.notNull).toBe(false);
		expect(columns.tournamentId.notNull).toBe(false);
		expect(columns.currencyId.notNull).toBe(false);
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.cashOut.notNull).toBe(false);
		expect(columns.memo.notNull).toBe(false);
	});
});
