import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionChipPurchaseResult } from "../schema/session-chip-purchase-result";

describe("SessionChipPurchaseResult schema — columns", () => {
	const columns = getTableColumns(sessionChipPurchaseResult);

	it("has exactly the expected columns", () => {
		expect(Object.keys(columns).sort()).toEqual(
			["sessionChipPurchaseId", "count"].sort()
		);
	});

	it("sessionChipPurchaseId is primary key (PK=FK, one result per purchase)", () => {
		expect(columns.sessionChipPurchaseId.primary).toBe(true);
	});

	it("sessionChipPurchaseId is NOT NULL with string dataType", () => {
		expect(columns.sessionChipPurchaseId.notNull).toBe(true);
		expect(columns.sessionChipPurchaseId.dataType).toBe("string");
	});

	it("count is NOT NULL with default 0", () => {
		expect(columns.count.notNull).toBe(true);
		expect(columns.count.default).toBe(0);
	});

	it("count has number dataType", () => {
		expect(columns.count.dataType).toBe("number");
	});
});

describe("SessionChipPurchaseResult — FK cascade policies", () => {
	const config = getTableConfig(sessionChipPurchaseResult);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionChipPurchaseId FK cascades (result dies with the purchase row)", () => {
		expect(fkByColumn("session_chip_purchase_id")?.onDelete).toBe("cascade");
	});

	it("sessionChipPurchaseId FK references session_chip_purchase.id", () => {
		const fk = fkByColumn("session_chip_purchase_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has exactly 1 foreign key", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("SessionChipPurchaseResult — table name", () => {
	it("table is named session_chip_purchase_result", () => {
		const config = getTableConfig(sessionChipPurchaseResult);
		expect(config.name).toBe("session_chip_purchase_result");
	});
});
