import { getTableColumns } from "drizzle-orm";
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { item, itemTransaction } from "../schema/item";

describe("Item schema — columns", () => {
	const columns = getTableColumns(item);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"name",
				"currencyId",
				"unitValue",
				"description",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		expect(columns.userId.notNull).toBe(true);
	});

	it("name is not null", () => {
		expect(columns.name.notNull).toBe(true);
	});

	it("currencyId is not null (an item's value is always denominated in a currency)", () => {
		expect(columns.currencyId.notNull).toBe(true);
	});

	it("unitValue is a not-null integer", () => {
		expect(columns.unitValue.notNull).toBe(true);
		expect(columns.unitValue.dataType).toBe("number");
	});

	it("description is nullable", () => {
		expect(columns.description.notNull).toBe(false);
	});

	it("createdAt and updatedAt are not null", () => {
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.updatedAt.notNull).toBe(true);
	});

	it("createdAt has a default (unixepoch)", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});
});

describe("Item — FK policies", () => {
	const config = getTableConfig(item);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades (items die with their owner)", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("currencyId FK has no cascade (currency deletion is guarded in the router instead)", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBeUndefined();
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("all FKs reference id columns", () => {
		for (const fk of config.foreignKeys) {
			expect(fk.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
		}
	});
});

describe("Item — indexes and table name", () => {
	const config = getTableConfig(item);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has item_userId_idx", () => {
		expect(idxNames).toContain("item_userId_idx");
	});

	it("has item_currencyId_idx", () => {
		expect(idxNames).toContain("item_currencyId_idx");
	});

	it("table is named item", () => {
		expect(config.name).toBe("item");
	});
});

describe("ItemTransaction schema — columns", () => {
	const columns = getTableColumns(itemTransaction);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"itemId",
				"sessionId",
				"count",
				"transactedAt",
				"memo",
				"createdAt",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("itemId is not null", () => {
		expect(columns.itemId.notNull).toBe(true);
	});

	it("sessionId is nullable (null = manual entry)", () => {
		expect(columns.sessionId.notNull).toBe(false);
	});

	it("count is a not-null integer (signed: + gains, - spends)", () => {
		expect(columns.count.notNull).toBe(true);
		expect(columns.count.dataType).toBe("number");
	});

	it("transactedAt is a not-null timestamp", () => {
		expect(columns.transactedAt.notNull).toBe(true);
		expect(columns.transactedAt.dataType).toBe("date");
	});

	it("memo is nullable", () => {
		expect(columns.memo.notNull).toBe(false);
	});

	it("createdAt is not null with a default", () => {
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.createdAt.hasDefault).toBe(true);
	});
});

describe("ItemTransaction — FK policies", () => {
	const config = getTableConfig(itemTransaction);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("itemId FK cascades (ledger rows die with their item; item delete is guarded in the router)", () => {
		expect(fkByColumn("item_id")?.onDelete).toBe("cascade");
	});

	it("sessionId FK cascades (session-generated rows die with the session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});
});

describe("ItemTransaction — indexes and table name", () => {
	const config = getTableConfig(itemTransaction);
	const idxNames = config.indexes.map((i) => i.config.name);
	const dialect = new SQLiteSyncDialect();

	it("has itemTransaction_itemId_idx", () => {
		expect(idxNames).toContain("itemTransaction_itemId_idx");
	});

	it("has itemTransaction_sessionId_idx", () => {
		expect(idxNames).toContain("itemTransaction_sessionId_idx");
	});

	it("has a partial unique index on (sessionId, itemId) for session-generated rows", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(1);

		const [index] = uniqueIdxs;
		expect(index?.config.name).toBe("itemTransaction_session_item_idx");
		expect(
			index?.config.columns.map((c) => (c as { name: string }).name)
		).toEqual(["session_id", "item_id"]);

		const where = dialect.sqlToQuery(index?.config.where as never);
		expect(where.sql).toContain('"item_transaction"."session_id" is not null');
	});

	it("table is named item_transaction", () => {
		expect(config.name).toBe("item_transaction");
	});
});
