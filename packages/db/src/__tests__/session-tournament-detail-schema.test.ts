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
				"ruleName",
				"startingStack",
				"bountyAmount",
				"tableSize",
				"buyIn",
				"entryFee",
				"variantId",
				"placement",
				"totalEntries",
				"beforeDeadline",
				"prizeMoney",
				"bountyPrizes",
				"timerStartedAt",
			])
		);
	});

	it("does NOT have old chip-purchase columns (rebuyCount, rebuyCost, addonCost)", () => {
		expect((columns as Record<string, unknown>).rebuyCount).toBeUndefined();
		expect((columns as Record<string, unknown>).rebuyCost).toBeUndefined();
		expect((columns as Record<string, unknown>).addonCost).toBeUndefined();
	});

	it("does NOT have old tournamentBuyIn column (renamed to buyIn)", () => {
		expect(
			(columns as Record<string, unknown>).tournamentBuyIn
		).toBeUndefined();
	});

	it("sessionId is primary key (PK=FK)", () => {
		expect(columns.sessionId.primary).toBe(true);
	});

	it("tournamentId is nullable (informational SET NULL)", () => {
		expect(columns.tournamentId.notNull).toBe(false);
	});

	it("ruleName is not null (required snapshot)", () => {
		expect(columns.ruleName.notNull).toBe(true);
	});

	it("startingStack / bountyAmount / tableSize are nullable integers", () => {
		expect(columns.startingStack.notNull).toBe(false);
		expect(columns.bountyAmount.notNull).toBe(false);
		expect(columns.tableSize.notNull).toBe(false);
		expect(columns.startingStack.dataType).toBe("number");
		expect(columns.bountyAmount.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
	});

	it("buyIn is not null (required snapshot)", () => {
		expect(columns.buyIn.notNull).toBe(true);
		expect(columns.buyIn.dataType).toBe("number");
	});

	it("entryFee is not null with default 0", () => {
		expect(columns.entryFee.notNull).toBe(true);
		expect(columns.entryFee.hasDefault).toBe(true);
		expect(columns.entryFee.default).toBe(0);
		expect(columns.entryFee.dataType).toBe("number");
	});

	it("variantId is not null (RESTRICT FK to variant master)", () => {
		expect(columns.variantId.notNull).toBe(true);
		expect(columns.variantId.dataType).toBe("number");
	});

	it("placement / totalEntries / prizeMoney / bountyPrizes are nullable result columns", () => {
		expect(columns.placement.notNull).toBe(false);
		expect(columns.totalEntries.notNull).toBe(false);
		expect(columns.prizeMoney.notNull).toBe(false);
		expect(columns.bountyPrizes.notNull).toBe(false);
	});

	it("beforeDeadline is nullable boolean", () => {
		expect(columns.beforeDeadline.notNull).toBe(false);
		expect(columns.beforeDeadline.dataType).toBe("boolean");
	});

	it("timerStartedAt is nullable canonical timestamp", () => {
		expect(columns.timerStartedAt.notNull).toBe(false);
		expect(columns.timerStartedAt.dataType).toBe("date");
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

	it("variantId FK uses restrict (variant deletion blocked while referenced)", () => {
		expect(fkByColumn("variant_id")?.onDelete).toBe("restrict");
	});

	it("has exactly 3 foreign keys (session, tournament, variant)", () => {
		expect(config.foreignKeys).toHaveLength(3);
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});
});

describe("SessionTournamentDetail — CHECK constraint", () => {
	const config = getTableConfig(sessionTournamentDetail);

	it("has a check constraint for before_deadline logic", () => {
		expect(config.checks.length).toBeGreaterThanOrEqual(1);
	});

	it("check constraint is named session_tournament_before_deadline_check", () => {
		const ck = config.checks.find(
			(c) => c.name === "session_tournament_before_deadline_check"
		);
		expect(ck).toBeDefined();
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
