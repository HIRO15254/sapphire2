import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { room } from "../schema/room";

describe("Room schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(room);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(room);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(room);
		expect(columns.userId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(room);
		expect(columns.name.notNull).toBe(true);
	});

	it("memo is nullable", () => {
		const columns = getTableColumns(room);
		expect(columns.memo.notNull).toBe(false);
	});
});

describe("Room schema — constraints", () => {
	const config = getTableConfig(room);

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

	it("has a userId index for per-user room lookups", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("room_userId_idx");
	});

	it("createdAt has a default (unixepoch)", () => {
		const columns = getTableColumns(room);
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("createdAt and updatedAt are not null", () => {
		const columns = getTableColumns(room);
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.updatedAt.notNull).toBe(true);
	});

	it("updatedAt uses $onUpdate hook", () => {
		const columns = getTableColumns(room);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("timestamps use date (timestamp) mode", () => {
		const columns = getTableColumns(room);
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
		const columns = getTableColumns(room);
		expect(columns.memo.dataType).toBe("string");
	});
});
