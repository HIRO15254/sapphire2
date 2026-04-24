import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
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

	it("createdAt has a default (unixepoch)", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("createdAt is not null", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.createdAt.notNull).toBe(true);
	});

	it("uses timestamp mode for transactedAt and createdAt", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.transactedAt.dataType).toBe("date");
		expect(columns.createdAt.dataType).toBe("date");
	});

	it("amount column is an integer", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.amount.dataType).toBe("number");
	});
});

describe("Currency schema — FKs and indexes", () => {
	const config = getTableConfig(currency);

	it("userId FK cascades on user deletion", () => {
		const fks = config.foreignKeys.map((fk) => ({
			onDelete: fk.onDelete,
			columns: fk.reference().columns.map((c) => c.name),
		}));
		expect(fks).toContainEqual({
			onDelete: "cascade",
			columns: ["user_id"],
		});
	});

	it("has a userId index for per-user lookups", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("currency_userId_idx");
	});

	it("createdAt has a default (unixepoch)", () => {
		const columns = getTableColumns(currency);
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt is backed by $onUpdate and is not null", () => {
		const columns = getTableColumns(currency);
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("has no composite primary key (id is single-column PK)", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});

	it("uses sqlite text type for name and unit", () => {
		const columns = getTableColumns(currency);
		expect(columns.name.dataType).toBe("string");
		expect(columns.unit.dataType).toBe("string");
	});
});

describe("TransactionType schema — FKs and indexes", () => {
	const config = getTableConfig(transactionType);

	it("userId FK cascades on user deletion", () => {
		const fks = config.foreignKeys.map((fk) => ({
			onDelete: fk.onDelete,
			columns: fk.reference().columns.map((c) => c.name),
		}));
		expect(fks).toContainEqual({
			onDelete: "cascade",
			columns: ["user_id"],
		});
	});

	it("has a userId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("transactionType_userId_idx");
	});

	it("createdAt has a default", () => {
		const columns = getTableColumns(transactionType);
		expect(columns.createdAt.hasDefault).toBe(true);
	});
});

describe("CurrencyTransaction schema — FKs and indexes", () => {
	const config = getTableConfig(currencyTransaction);

	it("cascades when the owning currency is deleted", () => {
		const currencyFk = config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === "currency_id")
		);
		expect(currencyFk).toBeDefined();
		expect(currencyFk?.onDelete).toBe("cascade");
	});

	it("does NOT cascade when the transactionType is deleted (restrict/default)", () => {
		const ttFk = config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === "transaction_type_id")
		);
		expect(ttFk).toBeDefined();
		// No explicit onDelete means undefined (default RESTRICT at DB level)
		expect(ttFk?.onDelete).toBeUndefined();
	});

	it("cascades when the linked session is deleted", () => {
		const sessFk = config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === "session_id")
		);
		expect(sessFk).toBeDefined();
		expect(sessFk?.onDelete).toBe("cascade");
	});

	it("references the correct foreign tables", () => {
		const fkTargets = config.foreignKeys.map((fk) => ({
			columns: fk.reference().columns.map((c) => c.name),
			foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
		}));
		expect(fkTargets).toContainEqual({
			columns: ["currency_id"],
			foreignColumns: ["id"],
		});
		expect(fkTargets).toContainEqual({
			columns: ["transaction_type_id"],
			foreignColumns: ["id"],
		});
		expect(fkTargets).toContainEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
		});
	});

	it("has indexes on currencyId and sessionId for lookup performance", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("currencyTransaction_currencyId_idx");
		expect(idxNames).toContain("currencyTransaction_sessionId_idx");
	});

	it("has no unique indexes (transactions are append-only)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});

	it("sessionId is nullable (transactions may be standalone)", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.sessionId.notNull).toBe(false);
	});
});
