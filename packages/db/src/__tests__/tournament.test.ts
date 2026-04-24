import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "../schema/tournament";
import { tournamentTag } from "../schema/tournament-tag";

describe("Tournament schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(tournament);
		expect(columns.id).toBeDefined();
		expect(columns.storeId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.variant).toBeDefined();
		expect(columns.buyIn).toBeDefined();
		expect(columns.entryFee).toBeDefined();
		expect(columns.startingStack).toBeDefined();
		expect(columns.bountyAmount).toBeDefined();
		expect(columns.tableSize).toBeDefined();
		expect(columns.currencyId).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.archivedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("no longer has rebuy/addon columns", () => {
		const columns = getTableColumns(tournament) as Record<string, unknown>;
		expect(columns.rebuyAllowed).toBeUndefined();
		expect(columns.rebuyCost).toBeUndefined();
		expect(columns.rebuyChips).toBeUndefined();
		expect(columns.addonAllowed).toBeUndefined();
		expect(columns.addonCost).toBeUndefined();
		expect(columns.addonChips).toBeUndefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(tournament);
		expect(columns.id.primary).toBe(true);
	});

	it("storeId is not null", () => {
		const columns = getTableColumns(tournament);
		expect(columns.storeId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(tournament);
		expect(columns.name.notNull).toBe(true);
	});

	it("variant is not null", () => {
		const columns = getTableColumns(tournament);
		expect(columns.variant.notNull).toBe(true);
	});

	it("buyIn is nullable", () => {
		const columns = getTableColumns(tournament);
		expect(columns.buyIn.notNull).toBe(false);
	});

	it("currencyId is nullable", () => {
		const columns = getTableColumns(tournament);
		expect(columns.currencyId.notNull).toBe(false);
	});

	it("archivedAt is nullable", () => {
		const columns = getTableColumns(tournament);
		expect(columns.archivedAt.notNull).toBe(false);
	});

	it("memo is nullable", () => {
		const columns = getTableColumns(tournament);
		expect(columns.memo.notNull).toBe(false);
	});

	it("does not have a tags column", () => {
		const columns = getTableColumns(tournament);
		expect((columns as Record<string, unknown>).tags).toBeUndefined();
	});
});

describe("TournamentTag schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(tournamentTag);
		expect(columns.id).toBeDefined();
		expect(columns.tournamentId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.createdAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(tournamentTag);
		expect(columns.id.primary).toBe(true);
	});

	it("tournamentId is not null", () => {
		const columns = getTableColumns(tournamentTag);
		expect(columns.tournamentId.notNull).toBe(true);
	});

	it("name is not null", () => {
		const columns = getTableColumns(tournamentTag);
		expect(columns.name.notNull).toBe(true);
	});

	it("createdAt is not null", () => {
		const columns = getTableColumns(tournamentTag);
		expect(columns.createdAt.notNull).toBe(true);
	});
});

describe("BlindLevel schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.id).toBeDefined();
		expect(columns.tournamentId).toBeDefined();
		expect(columns.level).toBeDefined();
		expect(columns.isBreak).toBeDefined();
		expect(columns.blind1).toBeDefined();
		expect(columns.blind2).toBeDefined();
		expect(columns.blind3).toBeDefined();
		expect(columns.ante).toBeDefined();
		expect(columns.minutes).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.id.primary).toBe(true);
	});

	it("tournamentId is not null", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.tournamentId.notNull).toBe(true);
	});

	it("level is not null", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.level.notNull).toBe(true);
	});

	it("isBreak is not null", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.isBreak.notNull).toBe(true);
	});

	it("blind1 is nullable", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.blind1.notNull).toBe(false);
	});

	it("blind2 is nullable", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.blind2.notNull).toBe(false);
	});

	it("minutes is nullable", () => {
		const columns = getTableColumns(blindLevel);
		expect(columns.minutes.notNull).toBe(false);
	});
});

describe("TournamentChipPurchase schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(tournamentChipPurchase);
		expect(columns.id).toBeDefined();
		expect(columns.tournamentId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.cost).toBeDefined();
		expect(columns.chips).toBeDefined();
		expect(columns.sortOrder).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(tournamentChipPurchase);
		expect(columns.id.primary).toBe(true);
	});

	it("tournamentId is not null", () => {
		const columns = getTableColumns(tournamentChipPurchase);
		expect(columns.tournamentId.notNull).toBe(true);
	});

	it("name, cost, chips are not null", () => {
		const columns = getTableColumns(tournamentChipPurchase);
		expect(columns.name.notNull).toBe(true);
		expect(columns.cost.notNull).toBe(true);
		expect(columns.chips.notNull).toBe(true);
	});
});

describe("Tournament — FKs, indexes, and defaults", () => {
	const config = getTableConfig(tournament);
	const columns = getTableColumns(tournament);
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

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("has storeId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("tournament_storeId_idx");
	});

	it("variant defaults to nlh", () => {
		expect(columns.variant.hasDefault).toBe(true);
		expect(columns.variant.default).toBe("nlh");
	});

	it("createdAt has a default, updatedAt uses $onUpdate", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("archivedAt is nullable timestamp", () => {
		expect(columns.archivedAt.dataType).toBe("date");
		expect(columns.archivedAt.notNull).toBe(false);
	});

	it("buyIn/entryFee/startingStack/bountyAmount/tableSize are nullable integers", () => {
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
});

describe("TournamentTag — FKs, indexes, and defaults", () => {
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

describe("BlindLevel — FKs, indexes, and defaults", () => {
	const config = getTableConfig(blindLevel);
	const columns = getTableColumns(blindLevel);

	it("tournamentId FK cascades (levels die with their tournament)", () => {
		const fk = config.foreignKeys.find((f) =>
			f.reference().columns.some((c) => c.name === "tournament_id")
		);
		expect(fk?.onDelete).toBe("cascade");
	});

	it("has exactly 1 foreign key", () => {
		expect(config.foreignKeys).toHaveLength(1);
	});

	it("has tournamentId index", () => {
		const idxNames = config.indexes.map((i) => i.config.name);
		expect(idxNames).toContain("blindLevel_tournamentId_idx");
	});

	it("isBreak defaults to false", () => {
		expect(columns.isBreak.hasDefault).toBe(true);
		expect(columns.isBreak.default).toBe(false);
	});

	it("isBreak is stored as boolean mode", () => {
		expect(columns.isBreak.dataType).toBe("boolean");
	});

	it("level is an integer and not null", () => {
		expect(columns.level.dataType).toBe("number");
		expect(columns.level.notNull).toBe(true);
	});

	it("ante and minutes are nullable integers", () => {
		expect(columns.ante.notNull).toBe(false);
		expect(columns.minutes.notNull).toBe(false);
	});
});

describe("TournamentChipPurchase — FKs, indexes, and defaults", () => {
	const config = getTableConfig(tournamentChipPurchase);
	const columns = getTableColumns(tournamentChipPurchase);

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

	it("sortOrder defaults to 0", () => {
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
	});

	it("sortOrder is a not-null integer (preserves display order)", () => {
		expect(columns.sortOrder.dataType).toBe("number");
		expect(columns.sortOrder.notNull).toBe(true);
	});

	it("cost and chips are integer and not null", () => {
		expect(columns.cost.dataType).toBe("number");
		expect(columns.chips.dataType).toBe("number");
		expect(columns.cost.notNull).toBe(true);
		expect(columns.chips.notNull).toBe(true);
	});
});
