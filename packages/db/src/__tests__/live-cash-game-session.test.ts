import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
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

describe("LiveCashGameSession — FK cascade policies", () => {
	const config = getTableConfig(liveCashGameSession);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("storeId FK uses set null (session survives store removal)", () => {
		expect(fkByColumn("store_id")?.onDelete).toBe("set null");
	});

	it("ringGameId FK uses set null", () => {
		expect(fkByColumn("ring_game_id")?.onDelete).toBe("set null");
	});

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("has exactly 4 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(4);
	});

	it("references the correct foreign columns", () => {
		const pairs = config.foreignKeys.map((fk) => ({
			columns: fk.reference().columns.map((c) => c.name),
			foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
		}));
		for (const p of pairs) {
			expect(p.foreignColumns).toEqual(["id"]);
		}
	});
});

describe("LiveCashGameSession — indexes", () => {
	const config = getTableConfig(liveCashGameSession);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has userId index", () => {
		expect(idxNames).toContain("liveCashGameSession_userId_idx");
	});

	it("has status index for active-session queries", () => {
		expect(idxNames).toContain("liveCashGameSession_status_idx");
	});

	it("has storeId index", () => {
		expect(idxNames).toContain("liveCashGameSession_storeId_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("LiveCashGameSession — defaults and column types", () => {
	const columns = getTableColumns(liveCashGameSession);

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("startedAt / endedAt / createdAt / updatedAt are timestamp mode", () => {
		expect(columns.startedAt.dataType).toBe("date");
		expect(columns.endedAt.dataType).toBe("date");
		expect(columns.createdAt.dataType).toBe("date");
		expect(columns.updatedAt.dataType).toBe("date");
	});

	it("heroSeatPosition is a nullable integer", () => {
		expect(columns.heroSeatPosition.notNull).toBe(false);
		expect(columns.heroSeatPosition.dataType).toBe("number");
	});

	it("status is stored as string (not enum constraint at DB level)", () => {
		expect(columns.status.dataType).toBe("string");
	});
});
