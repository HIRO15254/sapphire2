import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { gameVariant } from "../schema/game-variant";

describe("GameVariant schema — columns", () => {
	const columns = getTableColumns(gameVariant);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"builtinKey",
				"label",
				"shortLabel",
				"groupId",
				"sortOrder",
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

	it("builtinKey is nullable (null for user-created variants)", () => {
		expect(columns.builtinKey.notNull).toBe(false);
	});

	it("label is not null", () => {
		expect(columns.label.notNull).toBe(true);
	});

	it("shortLabel is nullable", () => {
		expect(columns.shortLabel.notNull).toBe(false);
	});

	it("groupId is not null", () => {
		expect(columns.groupId.notNull).toBe(true);
	});

	it("sortOrder is not null and defaults to 0", () => {
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
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

describe("GameVariant — FK cascade policies", () => {
	const config = getTableConfig(gameVariant);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("userId FK references the user id column", () => {
		const fk = fkByColumn("user_id")?.reference();
		expect(fk?.foreignColumns.map((c) => c.name)).toEqual(["id"]);
		expect(getTableConfig(fk?.foreignTable as never).name).toBe("user");
	});

	it("groupId FK restricts deletion (a group in use cannot vanish under a variant)", () => {
		expect(fkByColumn("group_id")?.onDelete).toBe("restrict");
	});

	it("groupId FK references the game_group id column", () => {
		const fk = fkByColumn("group_id")?.reference();
		expect(fk?.foreignColumns.map((c) => c.name)).toEqual(["id"]);
		expect(getTableConfig(fk?.foreignTable as never).name).toBe("game_group");
	});
});

describe("GameVariant — indexes", () => {
	const config = getTableConfig(gameVariant);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has gameVariant_userId_idx for owner-scoped queries", () => {
		expect(idxNames).toContain("gameVariant_userId_idx");
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

describe("GameVariant — table name", () => {
	it("table is named game_variant", () => {
		const config = getTableConfig(gameVariant);
		expect(config.name).toBe("game_variant");
	});
});
