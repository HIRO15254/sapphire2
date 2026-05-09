import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionBlindLevel } from "../schema/session-blind-level";

describe("SessionBlindLevel schema — columns", () => {
	const columns = getTableColumns(sessionBlindLevel);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"sessionId",
				"levelIndex",
				"isBreak",
				"minutes",
				"sortOrder",
			])
		);
	});

	it("id is auto-increment primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is not null", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("levelIndex is not null integer", () => {
		expect(columns.levelIndex.notNull).toBe(true);
		expect(columns.levelIndex.dataType).toBe("number");
	});

	it("isBreak defaults to false", () => {
		expect(columns.isBreak.hasDefault).toBe(true);
		expect(columns.isBreak.default).toBe(false);
		expect(columns.isBreak.dataType).toBe("boolean");
	});

	it("minutes is nullable", () => {
		expect(columns.minutes.notNull).toBe(false);
	});

	it("sortOrder is not null integer", () => {
		expect(columns.sortOrder.notNull).toBe(true);
		expect(columns.sortOrder.dataType).toBe("number");
	});
});

describe("SessionBlindLevel — FK cascade policies", () => {
	const config = getTableConfig(sessionBlindLevel);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (levels die with their session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 FK", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("SessionBlindLevel — UNIQUE constraint", () => {
	const config = getTableConfig(sessionBlindLevel);

	it("has UNIQUE(session_id, sort_order)", () => {
		const uniq = config.uniqueConstraints.find(
			(u) =>
				u.columns.some((c) => c.name === "session_id") &&
				u.columns.some((c) => c.name === "sort_order")
		);
		expect(uniq).toBeDefined();
	});
});

describe("SessionBlindLevel — table name", () => {
	it("table is named session_blind_level", () => {
		const config = getTableConfig(sessionBlindLevel);
		expect(config.name).toBe("session_blind_level");
	});
});
