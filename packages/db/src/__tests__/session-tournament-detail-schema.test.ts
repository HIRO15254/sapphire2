import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionTournamentDetail } from "../schema/session-tournament-detail";

describe("SessionTournamentDetail schema — columns", () => {
	const columns = getTableColumns(sessionTournamentDetail);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"sessionId",
				"tournamentId",
				"tournamentBuyIn",
				"entryFee",
				"placement",
				"totalEntries",
				"beforeDeadline",
				"prizeMoney",
				"rebuyCount",
				"rebuyCost",
				"addonCost",
				"bountyPrizes",
				"timerStartedAt",
			])
		);
	});

	it("sessionId is primary key (PK=FK)", () => {
		expect(columns.sessionId.primary).toBe(true);
	});

	it("tournamentId is nullable", () => {
		expect(columns.tournamentId.notNull).toBe(false);
	});

	it("all financial and placement columns are nullable", () => {
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

	it("beforeDeadline is nullable boolean", () => {
		expect(columns.beforeDeadline.notNull).toBe(false);
		expect(columns.beforeDeadline.dataType).toBe("boolean");
	});

	it("timerStartedAt is nullable timestamp", () => {
		expect(columns.timerStartedAt.notNull).toBe(false);
		expect(columns.timerStartedAt.dataType).toBe("date");
	});

	it("integer columns have number dataType", () => {
		expect(columns.tournamentBuyIn.dataType).toBe("number");
		expect(columns.entryFee.dataType).toBe("number");
		expect(columns.placement.dataType).toBe("number");
		expect(columns.totalEntries.dataType).toBe("number");
		expect(columns.prizeMoney.dataType).toBe("number");
		expect(columns.rebuyCount.dataType).toBe("number");
		expect(columns.rebuyCost.dataType).toBe("number");
		expect(columns.addonCost.dataType).toBe("number");
		expect(columns.bountyPrizes.dataType).toBe("number");
	});
});

describe("SessionTournamentDetail — FK cascade policies", () => {
	const config = getTableConfig(sessionTournamentDetail);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (detail dies with parent session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("tournamentId FK uses set null (detail survives tournament removal)", () => {
		expect(fkByColumn("tournament_id")?.onDelete).toBe("set null");
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});
});

describe("SessionTournamentDetail — indexes", () => {
	const config = getTableConfig(sessionTournamentDetail);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has session_tournament_tournament_idx for tournament lookups", () => {
		expect(idxNames).toContain("session_tournament_tournament_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("SessionTournamentDetail — table name", () => {
	it("table is named session_tournament_detail", () => {
		const config = getTableConfig(sessionTournamentDetail);
		expect(config.name).toBe("session_tournament_detail");
	});
});
