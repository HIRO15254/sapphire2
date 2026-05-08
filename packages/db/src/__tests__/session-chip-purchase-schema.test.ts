import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionChipPurchase } from "../schema/session-chip-purchase";

describe("SessionChipPurchase schema — columns", () => {
	const columns = getTableColumns(sessionChipPurchase);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"sessionId",
				"name",
				"cost",
				"chips",
				"sortOrder",
			])
		);
	});

	it("id is the primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is non-null string", () => {
		expect(columns.sessionId.notNull).toBe(true);
		expect(columns.sessionId.dataType).toBe("string");
	});

	it("name is non-null string", () => {
		expect(columns.name.notNull).toBe(true);
		expect(columns.name.dataType).toBe("string");
	});

	it("cost / chips are non-null integers", () => {
		expect(columns.cost.notNull).toBe(true);
		expect(columns.cost.dataType).toBe("number");
		expect(columns.chips.notNull).toBe(true);
		expect(columns.chips.dataType).toBe("number");
	});

	it("sortOrder is non-null integer with default 0", () => {
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.sortOrder.dataType).toBe("number");
		expect(columns.sortOrder.default).toBe(0);
	});
});

describe("SessionChipPurchase — FK cascade policies", () => {
	const config = getTableConfig(sessionChipPurchase);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (purchases die with parent session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 foreign key", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});
});

describe("SessionChipPurchase — indexes", () => {
	const config = getTableConfig(sessionChipPurchase);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has session_chip_purchase_session_idx for per-session lookups", () => {
		expect(idxNames).toContain("session_chip_purchase_session_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("SessionChipPurchase — table name", () => {
	it("table is named session_chip_purchase", () => {
		const config = getTableConfig(sessionChipPurchase);
		expect(config.name).toBe("session_chip_purchase");
	});
});
