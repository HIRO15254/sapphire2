import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { pokerSession } from "../schema/session";

describe("PokerSession schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.type).toBeDefined();
		expect(columns.sessionDate).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.userId.notNull).toBe(true);
	});

	it("type is not null", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.type.notNull).toBe(true);
	});

	it("sessionDate is not null", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.sessionDate.notNull).toBe(true);
	});

	it("optional columns are nullable", () => {
		const columns = getTableColumns(pokerSession);
		expect(columns.storeId.notNull).toBe(false);
		expect(columns.ringGameId.notNull).toBe(false);
		expect(columns.tournamentId.notNull).toBe(false);
		expect(columns.currencyId.notNull).toBe(false);
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.cashOut.notNull).toBe(false);
		expect(columns.memo.notNull).toBe(false);
	});
});

describe("PokerSession — FK cascade policies", () => {
	const config = getTableConfig(pokerSession);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades (sessions die with their owner)", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("storeId FK uses set null (history preserved when store removed)", () => {
		expect(fkByColumn("store_id")?.onDelete).toBe("set null");
	});

	it("ringGameId FK uses set null", () => {
		expect(fkByColumn("ring_game_id")?.onDelete).toBe("set null");
	});

	it("tournamentId FK uses set null", () => {
		expect(fkByColumn("tournament_id")?.onDelete).toBe("set null");
	});

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("liveCashGameSessionId FK uses set null", () => {
		expect(fkByColumn("live_cash_game_session_id")?.onDelete).toBe("set null");
	});

	it("liveTournamentSessionId FK uses set null", () => {
		expect(fkByColumn("live_tournament_session_id")?.onDelete).toBe("set null");
	});

	it("has at least 7 foreign keys", () => {
		expect(config.foreignKeys.length).toBeGreaterThanOrEqual(7);
	});
});

describe("PokerSession — indexes", () => {
	const config = getTableConfig(pokerSession);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has userId index", () => {
		expect(idxNames).toContain("pokerSession_userId_idx");
	});

	it("has sessionDate index for date-range queries", () => {
		expect(idxNames).toContain("pokerSession_sessionDate_idx");
	});

	it("has storeId index", () => {
		expect(idxNames).toContain("pokerSession_storeId_idx");
	});

	it("has currencyId index", () => {
		expect(idxNames).toContain("pokerSession_currencyId_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("PokerSession — defaults and modes", () => {
	const columns = getTableColumns(pokerSession);

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("sessionDate uses timestamp mode (date dataType)", () => {
		expect(columns.sessionDate.dataType).toBe("date");
	});

	it("beforeDeadline uses boolean mode", () => {
		// boolean mode maps to "boolean" dataType at Drizzle layer
		expect(columns.beforeDeadline.dataType).toBe("boolean");
	});

	it("startedAt / endedAt / breakMinutes are nullable", () => {
		expect(columns.startedAt.notNull).toBe(false);
		expect(columns.endedAt.notNull).toBe(false);
		expect(columns.breakMinutes.notNull).toBe(false);
	});

	it("tournament-only financial columns are nullable", () => {
		expect(columns.tournamentBuyIn.notNull).toBe(false);
		expect(columns.entryFee.notNull).toBe(false);
		expect(columns.placement.notNull).toBe(false);
		expect(columns.totalEntries.notNull).toBe(false);
		expect(columns.prizeMoney.notNull).toBe(false);
		expect(columns.rebuyCount.notNull).toBe(false);
		expect(columns.rebuyCost.notNull).toBe(false);
		expect(columns.addonCost.notNull).toBe(false);
		expect(columns.bountyPrizes.notNull).toBe(false);
	});
});
