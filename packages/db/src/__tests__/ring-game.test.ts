import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { ringGame } from "../schema/ring-game";

describe("RingGame schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.id).toBeDefined();
		expect(columns.storeId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.variant).toBeDefined();
		expect(columns.blind1).toBeDefined();
		expect(columns.blind2).toBeDefined();
		expect(columns.blind3).toBeDefined();
		expect(columns.ante).toBeDefined();
		expect(columns.anteType).toBeDefined();
		expect(columns.minBuyIn).toBeDefined();
		expect(columns.maxBuyIn).toBeDefined();
		expect(columns.tableSize).toBeDefined();
		expect(columns.currencyId).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.archivedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("anteType is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.anteType.notNull).toBe(false);
	});

	it("id is primary key", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.id.primary).toBe(true);
	});

	it("storeId is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.storeId.notNull).toBe(false);
	});

	it("name is not null", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.name.notNull).toBe(true);
	});

	it("variant is not null", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.variant.notNull).toBe(true);
	});

	it("blind1 is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.blind1.notNull).toBe(false);
	});

	it("blind2 is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.blind2.notNull).toBe(false);
	});

	it("blind3 is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.blind3.notNull).toBe(false);
	});

	it("currencyId is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.currencyId.notNull).toBe(false);
	});

	it("archivedAt is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.archivedAt.notNull).toBe(false);
	});

	it("memo is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.memo.notNull).toBe(false);
	});
});

describe("RingGame — defaults", () => {
	const columns = getTableColumns(ringGame);

	it("variant defaults to nlh", () => {
		expect(columns.variant.hasDefault).toBe(true);
		expect(columns.variant.default).toBe("nlh");
	});

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("archivedAt is timestamp mode", () => {
		expect(columns.archivedAt.dataType).toBe("date");
	});

	it("blind1/blind2/blind3/ante/minBuyIn/maxBuyIn/tableSize are integers", () => {
		expect(columns.blind1.dataType).toBe("number");
		expect(columns.blind2.dataType).toBe("number");
		expect(columns.blind3.dataType).toBe("number");
		expect(columns.ante.dataType).toBe("number");
		expect(columns.minBuyIn.dataType).toBe("number");
		expect(columns.maxBuyIn.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
	});
});

describe("RingGame — FK cascade policies", () => {
	const config = getTableConfig(ringGame);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("storeId FK cascades on store deletion", () => {
		expect(fkByColumn("store_id")?.onDelete).toBe("cascade");
	});

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});
});

describe("RingGame — indexes", () => {
	const config = getTableConfig(ringGame);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has storeId index for per-store ring-game listing", () => {
		expect(idxNames).toContain("ringGame_storeId_idx");
	});

	it("has no unique indexes (ring games can share names within a store)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});

	it("has no composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});
});
