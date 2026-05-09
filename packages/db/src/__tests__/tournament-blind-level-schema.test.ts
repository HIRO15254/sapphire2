import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { tournamentBlindLevel } from "../schema/tournament-blind-level";

describe("TournamentBlindLevel schema — columns", () => {
	const columns = getTableColumns(tournamentBlindLevel);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"tournamentId",
				"levelIndex",
				"isBreak",
				"minutes",
				"sortOrder",
			])
		);
	});

	it("does NOT have blind value columns (blind numbers live in tournament_blind_set)", () => {
		expect((columns as Record<string, unknown>).blind1).toBeUndefined();
		expect((columns as Record<string, unknown>).blind2).toBeUndefined();
		expect((columns as Record<string, unknown>).blind3).toBeUndefined();
		expect((columns as Record<string, unknown>).ante).toBeUndefined();
		expect((columns as Record<string, unknown>).level).toBeUndefined();
	});

	it("id is auto-increment primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("tournamentId is not null", () => {
		expect(columns.tournamentId.notNull).toBe(true);
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

describe("TournamentBlindLevel — FK cascade policies", () => {
	const config = getTableConfig(tournamentBlindLevel);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("tournamentId FK cascades (levels die with their tournament)", () => {
		expect(fkByColumn("tournament_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 1 FK", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});
});

describe("TournamentBlindLevel — UNIQUE constraint", () => {
	const config = getTableConfig(tournamentBlindLevel);

	it("has UNIQUE(tournament_id, sort_order)", () => {
		const uniq = config.uniqueConstraints.find(
			(u) =>
				u.columns.some((c) => c.name === "tournament_id") &&
				u.columns.some((c) => c.name === "sort_order")
		);
		expect(uniq).toBeDefined();
	});
});

describe("TournamentBlindLevel — table name", () => {
	it("table is named tournament_blind_level", () => {
		const config = getTableConfig(tournamentBlindLevel);
		expect(config.name).toBe("tournament_blind_level");
	});
});
