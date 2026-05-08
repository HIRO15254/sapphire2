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
				"level",
				"isBreak",
				"blind1",
				"blind2",
				"blind3",
				"ante",
				"minutes",
			])
		);
	});

	it("id is the primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is non-null string", () => {
		expect(columns.sessionId.notNull).toBe(true);
		expect(columns.sessionId.dataType).toBe("string");
	});

	it("level is non-null integer", () => {
		expect(columns.level.notNull).toBe(true);
		expect(columns.level.dataType).toBe("number");
	});

	it("isBreak is non-null boolean with default false", () => {
		expect(columns.isBreak.notNull).toBe(true);
		expect(columns.isBreak.dataType).toBe("boolean");
		expect(columns.isBreak.default).toBe(false);
	});

	it("blind1 / blind2 / blind3 / ante / minutes are nullable integers", () => {
		for (const key of [
			"blind1",
			"blind2",
			"blind3",
			"ante",
			"minutes",
		] as const) {
			expect(columns[key].notNull).toBe(false);
			expect(columns[key].dataType).toBe("number");
		}
	});
});

describe("SessionBlindLevel — FK cascade policies", () => {
	const config = getTableConfig(sessionBlindLevel);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (levels die with parent session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 foreign key", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});
});

describe("SessionBlindLevel — indexes", () => {
	const config = getTableConfig(sessionBlindLevel);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has session_blind_level_session_idx for per-session lookups", () => {
		expect(idxNames).toContain("session_blind_level_session_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("SessionBlindLevel — table name", () => {
	it("table is named session_blind_level", () => {
		const config = getTableConfig(sessionBlindLevel);
		expect(config.name).toBe("session_blind_level");
	});
});
