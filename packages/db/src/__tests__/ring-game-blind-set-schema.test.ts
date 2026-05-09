import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { ringGameBlindSet } from "../schema/ring-game-blind-set";

describe("RingGameBlindSet schema — columns", () => {
	const columns = getTableColumns(ringGameBlindSet);

	it("has all required columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"ringGameId",
				"limitFormatId",
				"blind1",
				"blind2",
				"blind3",
				"blind4",
				"ante",
				"anteType",
				"sortOrder",
			])
		);
	});

	it("id is primary key autoincrement", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("required columns are not null", () => {
		expect(columns.ringGameId.notNull).toBe(true);
		expect(columns.limitFormatId.notNull).toBe(true);
		expect(columns.blind1.notNull).toBe(true);
		expect(columns.blind2.notNull).toBe(true);
		expect(columns.sortOrder.notNull).toBe(true);
	});

	it("optional blind / ante columns are nullable", () => {
		expect(columns.blind3.notNull).toBe(false);
		expect(columns.blind4.notNull).toBe(false);
		expect(columns.ante.notNull).toBe(false);
		expect(columns.anteType.notNull).toBe(false);
	});

	it("sortOrder defaults to 0", () => {
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
	});
});

describe("RingGameBlindSet — FK policies", () => {
	const config = getTableConfig(ringGameBlindSet);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("ring_game_id FK cascades", () => {
		expect(fkByColumn("ring_game_id")?.onDelete).toBe("cascade");
	});

	it("limit_format_id FK uses RESTRICT", () => {
		expect(fkByColumn("limit_format_id")?.onDelete).toBe("restrict");
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("all FKs reference id column", () => {
		for (const fk of config.foreignKeys) {
			expect(fk.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
		}
	});
});

describe("RingGameBlindSet — indexes & unique", () => {
	const config = getTableConfig(ringGameBlindSet);

	it("has ring_game_id index", () => {
		const names = config.indexes.map((i) => i.config.name);
		expect(names).toContain("ringGameBlindSet_ringGameId_idx");
	});

	it("has UNIQUE(ring_game_id, sort_order)", () => {
		const uniq = config.uniqueConstraints.find(
			(u) => u.name === "ringGameBlindSet_ringGameId_sortOrder_uniq"
		);
		expect(uniq).toBeDefined();
		expect(uniq?.columns.map((c) => c.name)).toEqual([
			"ring_game_id",
			"sort_order",
		]);
	});
});

describe("RingGameBlindSet — table name", () => {
	it("table is named ring_game_blind_set", () => {
		const config = getTableConfig(ringGameBlindSet);
		expect(config.name).toBe("ring_game_blind_set");
	});
});
