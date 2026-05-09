import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { tournament, tournamentChipPurchase } from "../schema/tournament";
import { tournamentBlindLevel } from "../schema/tournament-blind-level";
import { tournamentTag } from "../schema/tournament-tag";

describe("Tournament schema — columns", () => {
	const columns = getTableColumns(tournament);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"storeId",
				"name",
				"variantId",
				"buyIn",
				"entryFee",
				"startingStack",
				"bountyAmount",
				"tableSize",
				"currencyId",
				"memo",
				"archivedAt",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("does NOT have old variant text column (replaced by variantId FK)", () => {
		expect((columns as Record<string, unknown>).variant).toBeUndefined();
	});

	it("does not have rebuy/addon columns", () => {
		const cols = columns as Record<string, unknown>;
		expect(cols.rebuyAllowed).toBeUndefined();
		expect(cols.rebuyCost).toBeUndefined();
		expect(cols.rebuyChips).toBeUndefined();
		expect(cols.addonAllowed).toBeUndefined();
		expect(cols.addonCost).toBeUndefined();
		expect(cols.addonChips).toBeUndefined();
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("storeId is not null", () => {
		expect(columns.storeId.notNull).toBe(true);
	});

	it("name is not null", () => {
		expect(columns.name.notNull).toBe(true);
	});

	it("variantId is nullable (informational SET NULL FK)", () => {
		expect(columns.variantId.notNull).toBe(false);
		expect(columns.variantId.dataType).toBe("number");
	});

	it("buyIn / entryFee / startingStack / bountyAmount / tableSize are nullable integers", () => {
		expect(columns.buyIn.dataType).toBe("number");
		expect(columns.entryFee.dataType).toBe("number");
		expect(columns.startingStack.dataType).toBe("number");
		expect(columns.bountyAmount.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.entryFee.notNull).toBe(false);
		expect(columns.startingStack.notNull).toBe(false);
		expect(columns.bountyAmount.notNull).toBe(false);
		expect(columns.tableSize.notNull).toBe(false);
	});

	it("currencyId is nullable", () => {
		expect(columns.currencyId.notNull).toBe(false);
	});

	it("archivedAt is nullable timestamp", () => {
		expect(columns.archivedAt.notNull).toBe(false);
		expect(columns.archivedAt.dataType).toBe("date");
	});

	it("memo is nullable", () => {
		expect(columns.memo.notNull).toBe(false);
	});

	it("does not have a tags column (tags are in a separate table)", () => {
		expect((columns as Record<string, unknown>).tags).toBeUndefined();
	});
});

describe("Tournament — defaults and timestamps", () => {
	const columns = getTableColumns(tournament);

	it("createdAt has a default, updatedAt uses $onUpdate", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});
});

describe("Tournament — FK cascade policies", () => {
	const config = getTableConfig(tournament);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("storeId FK cascades on store deletion", () => {
		expect(fkByColumn("store_id")?.onDelete).toBe("cascade");
	});

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("variantId FK uses set null (informational)", () => {
		expect(fkByColumn("variant_id")?.onDelete).toBe("set null");
	});

	it("has exactly 3 foreign keys (store, currency, variant)", () => {
		expect(config.foreignKeys).toHaveLength(3);
	});

	it("has storeId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("tournament_storeId_idx");
	});
});

describe("TournamentTag schema", () => {
	const columns = getTableColumns(tournamentTag);

	it("has required columns", () => {
		expect(columns.id).toBeDefined();
		expect(columns.tournamentId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.createdAt).toBeDefined();
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("tournamentId is not null", () => {
		expect(columns.tournamentId.notNull).toBe(true);
	});

	it("name is not null", () => {
		expect(columns.name.notNull).toBe(true);
	});

	it("createdAt is not null", () => {
		expect(columns.createdAt.notNull).toBe(true);
	});
});

describe("TournamentTag — FKs and indexes", () => {
	const config = getTableConfig(tournamentTag);
	const columns = getTableColumns(tournamentTag);

	it("tournamentId FK cascades (tags die with their tournament)", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "tournament_id")
		);
		expect(fk?.onDelete).toBe("cascade");
	});

	it("has tournamentId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("tournamentTag_tournamentId_idx");
	});

	it("createdAt has a default and is not null", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
		expect(columns.createdAt.notNull).toBe(true);
	});
});

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

	it("does NOT have inline blind value columns (moved to tournament_blind_set)", () => {
		expect((columns as Record<string, unknown>).blind1).toBeUndefined();
		expect((columns as Record<string, unknown>).blind2).toBeUndefined();
		expect((columns as Record<string, unknown>).blind3).toBeUndefined();
		expect((columns as Record<string, unknown>).ante).toBeUndefined();
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

	it("sortOrder is not null", () => {
		expect(columns.sortOrder.notNull).toBe(true);
	});
});

describe("TournamentBlindLevel — FK and uniqueness", () => {
	const config = getTableConfig(tournamentBlindLevel);

	it("tournamentId FK cascades (levels die with their tournament)", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "tournament_id")
		);
		expect(fk?.onDelete).toBe("cascade");
	});

	it("has exactly 1 FK (tournament)", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});

	it("has UNIQUE(tournament_id, sort_order)", () => {
		const uniq = config.uniqueConstraints.find(
			(u) =>
				u.columns.some((c) => c.name === "tournament_id") &&
				u.columns.some((c) => c.name === "sort_order")
		);
		expect(uniq).toBeDefined();
	});
});

describe("TournamentChipPurchase schema", () => {
	const columns = getTableColumns(tournamentChipPurchase);

	it("has required columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"tournamentId",
				"name",
				"cost",
				"chips",
				"sortOrder",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("tournamentId is not null", () => {
		expect(columns.tournamentId.notNull).toBe(true);
	});

	it("name, cost, chips are not null", () => {
		expect(columns.name.notNull).toBe(true);
		expect(columns.cost.notNull).toBe(true);
		expect(columns.chips.notNull).toBe(true);
	});

	it("sortOrder defaults to 0 and is not null", () => {
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
		expect(columns.sortOrder.notNull).toBe(true);
	});

	it("cost and chips are integers", () => {
		expect(columns.cost.dataType).toBe("number");
		expect(columns.chips.dataType).toBe("number");
	});
});

describe("TournamentChipPurchase — FKs and indexes", () => {
	const config = getTableConfig(tournamentChipPurchase);

	it("tournamentId FK cascades", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "tournament_id")
		);
		expect(fk?.onDelete).toBe("cascade");
	});

	it("has tournamentId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("tournamentChipPurchase_tournamentId_idx");
	});
});
