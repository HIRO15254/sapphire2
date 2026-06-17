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
				"bountyPrizes",
				"timerStartedAt",
				"ruleName",
				"variant",
				"startingStack",
				"bountyAmount",
				"tableSize",
				"result",
				"previousSessionId",
				"bagStack",
			])
		);
	});

	it("no longer has the legacy rebuyCount / rebuyCost / addonCost columns", () => {
		expect((columns as Record<string, unknown>).rebuyCount).toBeUndefined();
		expect((columns as Record<string, unknown>).rebuyCost).toBeUndefined();
		expect((columns as Record<string, unknown>).addonCost).toBeUndefined();
	});

	it("ruleName and variant are NOT NULL (snapshot is forced on insert)", () => {
		expect(columns.ruleName.notNull).toBe(true);
		expect(columns.variant.notNull).toBe(true);
	});

	it("ruleName has default 'Untitled' so ADD COLUMN succeeds on existing rows", () => {
		expect(columns.ruleName.default).toBe("Untitled");
	});

	it("variant has default 'nlh' so ADD COLUMN succeeds on existing rows", () => {
		expect(columns.variant.default).toBe("nlh");
	});

	it("startingStack / bountyAmount / tableSize snapshot columns are nullable", () => {
		expect(columns.startingStack.notNull).toBe(false);
		expect(columns.bountyAmount.notNull).toBe(false);
		expect(columns.tableSize.notNull).toBe(false);
	});

	it("startingStack / bountyAmount / tableSize have number dataType", () => {
		expect(columns.startingStack.dataType).toBe("number");
		expect(columns.bountyAmount.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
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

	it("previousSessionId FK uses set null (link survives the linked session's removal)", () => {
		expect(fkByColumn("previous_session_id")?.onDelete).toBe("set null");
	});

	it("previousSessionId FK references game_session.id", () => {
		const fk = fkByColumn("previous_session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});

	it("has exactly 3 foreign keys (session, tournament, previous-session link)", () => {
		expect(config.foreignKeys).toHaveLength(3);
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});
});

describe("SessionTournamentDetail — multi-day promote/link columns", () => {
	const columns = getTableColumns(sessionTournamentDetail);

	it("result is a nullable text column ('promoted' | 'finished')", () => {
		expect(columns.result.dataType).toBe("string");
		expect(columns.result.notNull).toBe(false);
		expect(columns.result.name).toBe("result");
	});

	it("previousSessionId is a nullable text column", () => {
		expect(columns.previousSessionId.dataType).toBe("string");
		expect(columns.previousSessionId.notNull).toBe(false);
		expect(columns.previousSessionId.name).toBe("previous_session_id");
	});

	it("bagStack is a nullable integer (carried into the next day's starting stack)", () => {
		expect(columns.bagStack.dataType).toBe("number");
		expect(columns.bagStack.notNull).toBe(false);
		expect(columns.bagStack.name).toBe("bag_stack");
	});
});

describe("SessionTournamentDetail — indexes", () => {
	const config = getTableConfig(sessionTournamentDetail);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has session_tournament_tournament_idx for tournament lookups", () => {
		expect(idxNames).toContain("session_tournament_tournament_idx");
	});

	it("has exactly 1 unique index (a promote is consumed by at most one next-day session)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(1);
	});

	it("the unique index guards previous_session_id", () => {
		const uniqueIdx = config.indexes.find(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdx?.config.name).toBe(
			"session_tournament_previous_session_unique"
		);
		expect(
			uniqueIdx?.config.columns.map((c) => (c as { name: string }).name)
		).toEqual(["previous_session_id"]);
	});
});

describe("SessionTournamentDetail — table name", () => {
	it("table is named session_tournament_detail", () => {
		const config = getTableConfig(sessionTournamentDetail);
		expect(config.name).toBe("session_tournament_detail");
	});
});
