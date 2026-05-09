import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { ringGame } from "../schema/ring-game";

describe("RingGame schema — columns", () => {
	const columns = getTableColumns(ringGame);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"storeId",
				"name",
				"variantId",
				"minBuyIn",
				"maxBuyIn",
				"tableSize",
				"currencyId",
				"memo",
				"archivedAt",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("does NOT have old blind columns (moved to ring_game_blind_set)", () => {
		expect((columns as Record<string, unknown>).variant).toBeUndefined();
		expect((columns as Record<string, unknown>).blind1).toBeUndefined();
		expect((columns as Record<string, unknown>).blind2).toBeUndefined();
		expect((columns as Record<string, unknown>).blind3).toBeUndefined();
		expect((columns as Record<string, unknown>).ante).toBeUndefined();
		expect((columns as Record<string, unknown>).anteType).toBeUndefined();
	});

	it("has variantId as informational FK (SET NULL)", () => {
		expect(columns.variantId).toBeDefined();
		expect(columns.variantId.notNull).toBe(false);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("storeId is nullable", () => {
		expect(columns.storeId.notNull).toBe(false);
	});

	it("name is not null", () => {
		expect(columns.name.notNull).toBe(true);
	});

	it("currencyId is nullable", () => {
		expect(columns.currencyId.notNull).toBe(false);
	});

	it("archivedAt is nullable timestamp", () => {
		expect(columns.archivedAt.notNull).toBe(false);
		expect(columns.archivedAt.dataType).toBe("date");
	});

	it("memo is nullable", () => {
		expect(columns.memo.notNull).toBe(false);
	});

	it("minBuyIn / maxBuyIn / tableSize are nullable integers", () => {
		expect(columns.minBuyIn.dataType).toBe("number");
		expect(columns.maxBuyIn.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
		expect(columns.minBuyIn.notNull).toBe(false);
		expect(columns.maxBuyIn.notNull).toBe(false);
		expect(columns.tableSize.notNull).toBe(false);
	});
});

describe("RingGame — defaults", () => {
	const columns = getTableColumns(ringGame);

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
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

	it("variantId FK uses set null (informational)", () => {
		expect(fkByColumn("variant_id")?.onDelete).toBe("set null");
	});

	it("has exactly 3 foreign keys (store, currency, variant)", () => {
		expect(config.foreignKeys).toHaveLength(3);
	});
});

describe("RingGame — indexes", () => {
	const config = getTableConfig(ringGame);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has storeId index for per-store ring-game listing", () => {
		expect(idxNames).toContain("ringGame_storeId_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});
