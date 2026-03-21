import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { blindLevel, tournament } from "../schema/tournament";

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
		expect(columns.rebuyAllowed).toBeDefined();
		expect(columns.rebuyCost).toBeDefined();
		expect(columns.rebuyChips).toBeDefined();
		expect(columns.addonAllowed).toBeDefined();
		expect(columns.addonCost).toBeDefined();
		expect(columns.addonChips).toBeDefined();
		expect(columns.bountyAmount).toBeDefined();
		expect(columns.tableSize).toBeDefined();
		expect(columns.currencyId).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.archivedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
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

	it("rebuyAllowed is not null", () => {
		const columns = getTableColumns(tournament);
		expect(columns.rebuyAllowed.notNull).toBe(true);
	});

	it("addonAllowed is not null", () => {
		const columns = getTableColumns(tournament);
		expect(columns.addonAllowed.notNull).toBe(true);
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

	it("has tags column", () => {
		const columns = getTableColumns(tournament);
		expect(columns.tags).toBeDefined();
	});

	it("tags is nullable", () => {
		const columns = getTableColumns(tournament);
		expect(columns.tags.notNull).toBe(false);
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
