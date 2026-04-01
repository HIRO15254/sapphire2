import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { liveCashGameSession } from "../schema/live-cash-game-session";

describe("LiveCashGameSession schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(liveCashGameSession);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.status).toBeDefined();
		expect(columns.startedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(liveCashGameSession);
		expect(columns.id.primary).toBe(true);
	});

	it("userId and status are not null", () => {
		const columns = getTableColumns(liveCashGameSession);
		expect(columns.userId.notNull).toBe(true);
		expect(columns.status.notNull).toBe(true);
	});

	it("startedAt is not null", () => {
		const columns = getTableColumns(liveCashGameSession);
		expect(columns.startedAt.notNull).toBe(true);
	});

	it("optional columns are nullable", () => {
		const columns = getTableColumns(liveCashGameSession);
		expect(columns.storeId.notNull).toBe(false);
		expect(columns.ringGameId.notNull).toBe(false);
		expect(columns.currencyId.notNull).toBe(false);
		expect(columns.endedAt.notNull).toBe(false);
		expect(columns.memo.notNull).toBe(false);
	});
});
