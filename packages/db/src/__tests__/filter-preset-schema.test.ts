import { getTableColumns } from "drizzle-orm";
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { filterPreset } from "../schema/filter-preset";

describe("FilterPreset schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.screenKey).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.payload).toBeDefined();
		expect(columns.isDefault).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.userId.notNull).toBe(true);
	});

	it("screenKey is not null", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.screenKey.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.name.notNull).toBe(true);
	});

	it("payload is not null and stored as json", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.payload.notNull).toBe(true);
		expect(columns.payload.dataType).toBe("json");
	});

	it("isDefault is not null with a default value of false", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.isDefault.notNull).toBe(true);
		expect(columns.isDefault.hasDefault).toBe(true);
		expect(columns.isDefault.dataType).toBe("boolean");
	});

	it("createdAt has a default (unixepoch) and is not null", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.createdAt.hasDefault).toBe(true);
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.createdAt.dataType).toBe("date");
	});

	it("updatedAt is backed by $onUpdate and is not null", () => {
		const columns = getTableColumns(filterPreset);
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
		expect(columns.updatedAt.dataType).toBe("date");
	});

	it("has no composite primary key (id is single-column PK)", () => {
		const config = getTableConfig(filterPreset);
		expect(config.primaryKeys).toHaveLength(0);
	});
});

describe("FilterPreset schema — FKs and indexes", () => {
	const config = getTableConfig(filterPreset);
	const dialect = new SQLiteSyncDialect();

	it("userId FK cascades on user deletion", () => {
		const fks = config.foreignKeys.map((fk) => ({
			onDelete: fk.onDelete,
			columns: fk.reference().columns.map((c) => c.name),
			foreignColumns: fk.reference().foreignColumns.map((c) => c.name),
		}));
		expect(fks).toContainEqual({
			onDelete: "cascade",
			columns: ["user_id"],
			foreignColumns: ["id"],
		});
	});

	it("has a plain userId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("filterPreset_userId_idx");
	});

	it("has a plain (userId, screenKey) composite index", () => {
		const idx = config.indexes.find(
			(i) => i.config.name === "filterPreset_userId_screenKey_idx"
		);
		expect(idx).toBeDefined();
		expect((idx?.config as unknown as { unique: boolean }).unique).toBe(false);
		const cols = (idx?.config.columns as unknown as { name?: string }[]).map(
			(c) => c.name
		);
		expect(cols).toEqual(["user_id", "screen_key"]);
	});

	it("has a UNIQUE composite index on (userId, screenKey, name)", () => {
		const idx = config.indexes.find(
			(i) => i.config.name === "filterPreset_userId_screenKey_name_idx"
		);
		expect(idx).toBeDefined();
		expect((idx?.config as unknown as { unique: boolean }).unique).toBe(true);
		const cols = (idx?.config.columns as unknown as { name?: string }[]).map(
			(c) => c.name
		);
		expect(cols).toEqual(["user_id", "screen_key", "name"]);
	});

	it("allows only one default preset per (userId, screenKey)", () => {
		const index = config.indexes.find(
			(i) => i.config.name === "filterPreset_userId_screenKey_defaultUnique_idx"
		);
		expect(index).toBeDefined();
		expect((index?.config as unknown as { unique: boolean }).unique).toBe(true);
		expect(index?.config.columns).toEqual([
			getTableColumns(filterPreset).userId,
			getTableColumns(filterPreset).screenKey,
		]);

		const where = dialect.sqlToQuery(index?.config.where as never);
		expect(where.sql).toContain('"filter_preset"."is_default" = 1');
	});

	it("has exactly 4 indexes total", () => {
		expect(config.indexes).toHaveLength(4);
	});

	it("has exactly 2 unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(2);
	});
});
