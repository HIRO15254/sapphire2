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

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId / name / cost / chips are NOT NULL", () => {
		expect(columns.sessionId.notNull).toBe(true);
		expect(columns.name.notNull).toBe(true);
		expect(columns.cost.notNull).toBe(true);
		expect(columns.chips.notNull).toBe(true);
	});

	it("sortOrder is NOT NULL with default 0", () => {
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
	});

	it("integer columns have number dataType", () => {
		expect(columns.cost.dataType).toBe("number");
		expect(columns.chips.dataType).toBe("number");
		expect(columns.sortOrder.dataType).toBe("number");
	});

	it("text columns have string dataType", () => {
		expect(columns.id.dataType).toBe("string");
		expect(columns.sessionId.dataType).toBe("string");
		expect(columns.name.dataType).toBe("string");
	});
});

describe("SessionChipPurchase — FK cascade policies", () => {
	const config = getTableConfig(sessionChipPurchase);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (snapshot dies with parent session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has exactly 1 foreign key (no tournament link — snapshot is frozen)", () => {
		expect(config.foreignKeys).toHaveLength(1);
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
