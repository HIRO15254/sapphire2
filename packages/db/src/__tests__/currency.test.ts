import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
	currency,
	currencyTransaction,
	transactionType,
} from "../schema/store";

describe("Currency schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(currency);
		expect(columns.id).toBeDefined();
		expect(columns.storeId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.unit).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(currency);
		expect(columns.id.primary).toBe(true);
	});

	it("storeId is not null", () => {
		const columns = getTableColumns(currency);
		expect(columns.storeId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(currency);
		expect(columns.name.notNull).toBe(true);
	});

	it("unit is nullable", () => {
		const columns = getTableColumns(currency);
		expect(columns.unit.notNull).toBe(false);
	});
});

describe("TransactionType schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(transactionType);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(transactionType);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(transactionType);
		expect(columns.userId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(transactionType);
		expect(columns.name.notNull).toBe(true);
	});
});

describe("CurrencyTransaction schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.id).toBeDefined();
		expect(columns.currencyId).toBeDefined();
		expect(columns.transactionTypeId).toBeDefined();
		expect(columns.amount).toBeDefined();
		expect(columns.transactedAt).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.createdAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.id.primary).toBe(true);
	});

	it("currencyId is not null", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.currencyId.notNull).toBe(true);
	});

	it("transactionTypeId is not null", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.transactionTypeId.notNull).toBe(true);
	});

	it("amount is not null", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.amount.notNull).toBe(true);
	});

	it("transactedAt is not null", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.transactedAt.notNull).toBe(true);
	});

	it("memo is nullable", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.memo.notNull).toBe(false);
	});
});
