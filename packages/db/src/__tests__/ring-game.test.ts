import { getTableColumns } from "drizzle-orm";
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

	it("storeId is not null", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.storeId.notNull).toBe(true);
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
