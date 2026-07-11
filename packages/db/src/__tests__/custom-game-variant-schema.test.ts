import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { customGameVariant } from "../schema/custom-game-variant";

describe("CustomGameVariant schema — columns", () => {
	const columns = getTableColumns(customGameVariant);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"label",
				"blind1Label",
				"blind2Label",
				"blind3Label",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("id is string type", () => {
		expect(columns.id.dataType).toBe("string");
	});

	it("userId is not null", () => {
		expect(columns.userId.notNull).toBe(true);
	});

	it("label is not null", () => {
		expect(columns.label.notNull).toBe(true);
	});

	it("blind1Label / blind2Label / blind3Label are nullable", () => {
		expect(columns.blind1Label.notNull).toBe(false);
		expect(columns.blind2Label.notNull).toBe(false);
		expect(columns.blind3Label.notNull).toBe(false);
	});

	it("blind1Label / blind2Label / blind3Label are string type", () => {
		expect(columns.blind1Label.dataType).toBe("string");
		expect(columns.blind2Label.dataType).toBe("string");
		expect(columns.blind3Label.dataType).toBe("string");
	});

	it("createdAt has a default and is timestamp mode", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
		expect(columns.createdAt.dataType).toBe("date");
	});

	it("updatedAt uses $onUpdate and is not null", () => {
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});
});

describe("CustomGameVariant — FK cascade policies", () => {
	const config = getTableConfig(customGameVariant);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("has exactly 1 foreign key", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});

	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("userId FK references the user id column", () => {
		const fk = fkByColumn("user_id")?.reference();
		expect(fk?.foreignColumns.map((c) => c.name)).toEqual(["id"]);
		expect(getTableConfig(fk?.foreignTable as never).name).toBe("user");
	});
});

describe("CustomGameVariant — indexes", () => {
	const config = getTableConfig(customGameVariant);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has customGameVariant_userId_idx for owner-scoped queries", () => {
		expect(idxNames).toContain("customGameVariant_userId_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});

	it("has no composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});
});

describe("CustomGameVariant — table name", () => {
	it("table is named custom_game_variant", () => {
		const config = getTableConfig(customGameVariant);
		expect(config.name).toBe("custom_game_variant");
	});
});
