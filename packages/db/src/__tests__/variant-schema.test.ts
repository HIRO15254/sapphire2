import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { variant } from "../schema/variant";

describe("Variant schema — columns", () => {
	const columns = getTableColumns(variant);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"name",
				"sortOrder",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("id is auto-increment primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("userId is nullable (NULL = system row, non-null = user-defined)", () => {
		expect(columns.userId.notNull).toBe(false);
	});

	it("name is not null", () => {
		expect(columns.name.notNull).toBe(true);
	});

	it("sortOrder is not null with default 0", () => {
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
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

describe("Variant — FK cascade policies", () => {
	const config = getTableConfig(variant);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades (user-defined variants die with their owner)", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 FK", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("Variant — table name", () => {
	it("table is named variant", () => {
		const config = getTableConfig(variant);
		expect(config.name).toBe("variant");
	});
});
