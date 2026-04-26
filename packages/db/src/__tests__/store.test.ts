import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { currency, currencyTransaction, store } from "../schema/store";

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

describe("Store schema — constraints", () => {
	const config = getTableConfig(store);

	it("userId FK cascades on user deletion", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "user_id")
		);
		expect(fk).toBeDefined();
		expect(fk?.onDelete).toBe("cascade");
	});

	it("userId FK references user.id", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "user_id")
		);
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has a userId index for per-user store lookups", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("store_userId_idx");
	});

	it("createdAt has a default (unixepoch)", () => {
		const columns = getTableColumns(store);
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("createdAt and updatedAt are not null", () => {
		const columns = getTableColumns(store);
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.updatedAt.notNull).toBe(true);
	});

	it("updatedAt uses $onUpdate hook", () => {
		const columns = getTableColumns(store);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("timestamps use date (timestamp) mode", () => {
		const columns = getTableColumns(store);
		expect(columns.createdAt.dataType).toBe("date");
		expect(columns.updatedAt.dataType).toBe("date");
	});

	it("has no composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});

	it("memo is of string data type", () => {
		const columns = getTableColumns(store);
		expect(columns.memo.dataType).toBe("string");
	});
});

describe("Currency schema (inspected from store.test) — constraints", () => {
	const config = getTableConfig(currency);

	it("userId FK cascades", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "user_id")
		);
		expect(fk?.onDelete).toBe("cascade");
	});

	it("has a userId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("currency_userId_idx");
	});
});

describe("CurrencyTransaction — sessionId FK references new game_session", () => {
	const config = getTableConfig(currencyTransaction);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("sessionId FK references game_session table (not poker_session)", () => {
		const { getTableConfig: gtc } = require("drizzle-orm/sqlite-core");
		const fk = fkByColumn("session_id");
		const foreignCol = fk?.reference().foreignColumns[0];
		const foreignTableConfig = foreignCol ? gtc(foreignCol.table) : undefined;
		expect(foreignTableConfig?.name).toBe("game_session");
	});

	it("sessionId FK references id column", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("sessionId is nullable (transaction may exist without a session)", () => {
		const columns = getTableColumns(currencyTransaction);
		expect(columns.sessionId.notNull).toBe(false);
	});
});
