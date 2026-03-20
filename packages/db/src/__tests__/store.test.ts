import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { currency, store } from "../schema/store";

describe("Store schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(store);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(store);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(store);
		expect(columns.userId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(store);
		expect(columns.name.notNull).toBe(true);
	});

	it("memo is nullable", () => {
		const columns = getTableColumns(store);
		expect(columns.memo.notNull).toBe(false);
	});
});

describe("Currency schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(currency);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.unit).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(currency);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(currency);
		expect(columns.userId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(currency);
		expect(columns.name.notNull).toBe(true);
	});
});
