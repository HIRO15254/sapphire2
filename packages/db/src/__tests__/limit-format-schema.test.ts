import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { limitFormat } from "../schema/limit-format";

describe("LimitFormat schema — columns", () => {
	const columns = getTableColumns(limitFormat);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"name",
				"blind1Label",
				"blind2Label",
				"blind3Label",
				"blind4Label",
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

	it("blind1Label and blind2Label are not null (required)", () => {
		expect(columns.blind1Label.notNull).toBe(true);
		expect(columns.blind2Label.notNull).toBe(true);
	});

	it("blind3Label and blind4Label are nullable (optional straddle / big-bet labels)", () => {
		expect(columns.blind3Label.notNull).toBe(false);
		expect(columns.blind4Label.notNull).toBe(false);
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

describe("LimitFormat — FK cascade policies", () => {
	const config = getTableConfig(limitFormat);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades (user-defined rows die with their owner)", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 FK", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("LimitFormat — table name", () => {
	it("table is named limit_format", () => {
		const config = getTableConfig(limitFormat);
		expect(config.name).toBe("limit_format");
	});
});
