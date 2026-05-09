import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
	sessionChipPurchaseOption,
	sessionChipPurchaseRecord,
} from "../schema/session-chip-purchase-option";

describe("SessionChipPurchaseOption schema — columns", () => {
	const columns = getTableColumns(sessionChipPurchaseOption);

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

	it("id is auto-increment primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is not null", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("name is not null", () => {
		expect(columns.name.notNull).toBe(true);
	});

	it("cost and chips are not null integers", () => {
		expect(columns.cost.notNull).toBe(true);
		expect(columns.chips.notNull).toBe(true);
		expect(columns.cost.dataType).toBe("number");
		expect(columns.chips.dataType).toBe("number");
	});

	it("sortOrder defaults to 0 and is not null", () => {
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
		expect(columns.sortOrder.notNull).toBe(true);
	});
});

describe("SessionChipPurchaseOption — FK cascade policies", () => {
	const config = getTableConfig(sessionChipPurchaseOption);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (options die with their session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 FK", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("SessionChipPurchaseOption — UNIQUE constraint", () => {
	const config = getTableConfig(sessionChipPurchaseOption);

	it("has UNIQUE(session_id, sort_order)", () => {
		const uniq = config.uniqueConstraints.find(
			(u) =>
				u.columns.some((c) => c.name === "session_id") &&
				u.columns.some((c) => c.name === "sort_order")
		);
		expect(uniq).toBeDefined();
	});
});

describe("SessionChipPurchaseOption — table name", () => {
	it("table is named session_chip_purchase_option", () => {
		const config = getTableConfig(sessionChipPurchaseOption);
		expect(config.name).toBe("session_chip_purchase_option");
	});
});

describe("SessionChipPurchaseRecord schema — columns", () => {
	const columns = getTableColumns(sessionChipPurchaseRecord);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining(["sessionId", "chipPurchaseOptionId", "count"])
		);
	});

	it("sessionId is not null", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("chipPurchaseOptionId is not null", () => {
		expect(columns.chipPurchaseOptionId.notNull).toBe(true);
	});

	it("count is not null integer", () => {
		expect(columns.count.notNull).toBe(true);
		expect(columns.count.dataType).toBe("number");
	});
});

describe("SessionChipPurchaseRecord — FK cascade policies", () => {
	const config = getTableConfig(sessionChipPurchaseRecord);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("chipPurchaseOptionId FK cascades (record dies with option)", () => {
		expect(fkByColumn("chip_purchase_option_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 2 FKs (session, option)", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});
});

describe("SessionChipPurchaseRecord — composite PK", () => {
	const config = getTableConfig(sessionChipPurchaseRecord);

	it("has composite PK on (session_id, chip_purchase_option_id)", () => {
		expect(config.primaryKeys).toHaveLength(1);
		const pk = config.primaryKeys[0];
		expect(pk.columns.map((c) => c.name)).toEqual([
			"session_id",
			"chip_purchase_option_id",
		]);
	});
});

describe("SessionChipPurchaseRecord — CHECK", () => {
	const config = getTableConfig(sessionChipPurchaseRecord);

	it("has count >= 0 CHECK constraint", () => {
		const ck = config.checks.find(
			(c) => c.name === "sessionChipPurchaseRecord_count_nonneg"
		);
		expect(ck).toBeDefined();
	});
});

describe("SessionChipPurchaseRecord — table name", () => {
	it("table is named session_chip_purchase_record", () => {
		const config = getTableConfig(sessionChipPurchaseRecord);
		expect(config.name).toBe("session_chip_purchase_record");
	});
});
