import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { gameMix } from "../schema/game-mix";

describe("GameMix schema — columns", () => {
	const columns = getTableColumns(gameMix);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"builtinKey",
				"label",
				"games",
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

	it("builtinKey is nullable (null for user-created mixes)", () => {
		expect(columns.builtinKey.notNull).toBe(false);
	});

	it("label is not null", () => {
		expect(columns.label.notNull).toBe(true);
	});

	it("games is not null and stored as JSON", () => {
		expect(columns.games.notNull).toBe(true);
		expect(columns.games.dataType).toBe("json");
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

describe("GameMix — FK cascade policies", () => {
	const config = getTableConfig(gameMix);
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

describe("GameMix — indexes", () => {
	const config = getTableConfig(gameMix);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has gameMix_userId_idx for owner-scoped queries", () => {
		expect(idxNames).toContain("gameMix_userId_idx");
	});

	it("has exactly 2 unique indexes (builtinKey + label backstops, c08/c14)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(2);
	});

	it("has a unique index on (userId, builtinKey) so a concurrent double-seed cannot duplicate a builtin row (c08)", () => {
		const idx = config.indexes.find(
			(i) => i.config.name === "gameMix_userId_builtinKey_idx"
		);
		expect(idx).toBeDefined();
		expect((idx?.config as unknown as { unique: boolean }).unique).toBe(true);
		expect(idx?.config.columns.map((c) => c.name)).toEqual([
			"user_id",
			"builtin_key",
		]);
	});

	it("has a unique index on (userId, label) as an exact-case backstop for the app-level label check (c14)", () => {
		const idx = config.indexes.find(
			(i) => i.config.name === "gameMix_userId_label_idx"
		);
		expect(idx).toBeDefined();
		expect((idx?.config as unknown as { unique: boolean }).unique).toBe(true);
		expect(idx?.config.columns.map((c) => c.name)).toEqual([
			"user_id",
			"label",
		]);
	});

	it("has no composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});
});

describe("GameMix — table name", () => {
	it("table is named game_mix", () => {
		const config = getTableConfig(gameMix);
		expect(config.name).toBe("game_mix");
	});
});
