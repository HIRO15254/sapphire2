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

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is NOT NULL", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("level is NOT NULL", () => {
		expect(columns.level.notNull).toBe(true);
	});

	it("isBreak is NOT NULL with default false", () => {
		expect(columns.isBreak.notNull).toBe(true);
		expect(columns.isBreak.default).toBe(false);
	});

	it("blind1 / blind2 / blind3 / ante / minutes are nullable", () => {
		expect(columns.blind1.notNull).toBe(false);
		expect(columns.blind2.notNull).toBe(false);
		expect(columns.blind3.notNull).toBe(false);
		expect(columns.ante.notNull).toBe(false);
		expect(columns.minutes.notNull).toBe(false);
	});

	it("isBreak is boolean dataType", () => {
		expect(columns.isBreak.dataType).toBe("boolean");
	});

	it("integer columns have number dataType", () => {
		expect(columns.level.dataType).toBe("number");
		expect(columns.blind1.dataType).toBe("number");
		expect(columns.blind2.dataType).toBe("number");
		expect(columns.blind3.dataType).toBe("number");
		expect(columns.ante.dataType).toBe("number");
		expect(columns.minutes.dataType).toBe("number");
	});
});

describe("SessionBlindLevel — FK cascade policies", () => {
	const config = getTableConfig(sessionBlindLevel);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (snapshot dies with parent session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has exactly 1 foreign key (no tournament link — snapshot is frozen)", () => {
		expect(config.foreignKeys).toHaveLength(1);
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
