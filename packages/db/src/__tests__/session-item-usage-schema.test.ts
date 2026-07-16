import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionItemUsage } from "../schema/session-item-usage";

describe("SessionItemUsage schema — columns", () => {
	const columns = getTableColumns(sessionItemUsage);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"sessionId",
				"itemId",
				"direction",
				"count",
				"itemName",
				"unitValue",
				"currencyId",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is not null", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("itemId is nullable (kept displayable after item deletion via snapshots)", () => {
		expect(columns.itemId.notNull).toBe(false);
	});

	it("direction is a not-null string", () => {
		expect(columns.direction.notNull).toBe(true);
		expect(columns.direction.dataType).toBe("string");
	});

	it("count is a not-null integer", () => {
		expect(columns.count.notNull).toBe(true);
		expect(columns.count.dataType).toBe("number");
	});

	it("snapshot itemName is not null", () => {
		expect(columns.itemName.notNull).toBe(true);
		expect(columns.itemName.dataType).toBe("string");
	});

	it("snapshot unitValue is a not-null integer", () => {
		expect(columns.unitValue.notNull).toBe(true);
		expect(columns.unitValue.dataType).toBe("number");
	});

	it("snapshot currencyId is nullable", () => {
		expect(columns.currencyId.notNull).toBe(false);
	});
});

describe("SessionItemUsage — FK policies", () => {
	const config = getTableConfig(sessionItemUsage);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (usage rows die with the session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("itemId FK uses set null (snapshot keeps the row readable after item deletion)", () => {
		expect(fkByColumn("item_id")?.onDelete).toBe("set null");
	});

	it("currencyId snapshot column has no FK (pure snapshot, survives currency deletion)", () => {
		expect(fkByColumn("currency_id")).toBeUndefined();
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});
});

describe("SessionItemUsage — indexes and table name", () => {
	const config = getTableConfig(sessionItemUsage);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has sessionItemUsage_sessionId_idx", () => {
		expect(idxNames).toContain("sessionItemUsage_sessionId_idx");
	});

	it("has sessionItemUsage_itemId_idx", () => {
		expect(idxNames).toContain("sessionItemUsage_itemId_idx");
	});

	it("has no unique indexes (multiple usages of the same item per session are allowed)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});

	it("table is named session_item_usage", () => {
		expect(config.name).toBe("session_item_usage");
	});
});
