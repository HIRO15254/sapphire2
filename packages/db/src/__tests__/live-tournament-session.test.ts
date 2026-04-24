import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { liveTournamentSession } from "../schema/live-tournament-session";

describe("LiveTournamentSession schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.id).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.status).toBeDefined();
		expect(columns.startedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.id.primary).toBe(true);
	});

	it("userId and status are not null", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.userId.notNull).toBe(true);
		expect(columns.status.notNull).toBe(true);
	});

	it("startedAt is not null", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.startedAt.notNull).toBe(true);
	});

	it("optional columns are nullable", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.storeId.notNull).toBe(false);
		expect(columns.tournamentId.notNull).toBe(false);
		expect(columns.currencyId.notNull).toBe(false);
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.entryFee.notNull).toBe(false);
		expect(columns.endedAt.notNull).toBe(false);
		expect(columns.memo.notNull).toBe(false);
	});

	it("has nullable timerStartedAt column for tournament timer", () => {
		const columns = getTableColumns(liveTournamentSession);
		expect(columns.timerStartedAt).toBeDefined();
		expect(columns.timerStartedAt.notNull).toBe(false);
	});
});

describe("LiveTournamentSession — FK cascade policies", () => {
	const config = getTableConfig(liveTournamentSession);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("storeId FK uses set null", () => {
		expect(fkByColumn("store_id")?.onDelete).toBe("set null");
	});

	it("tournamentId FK uses set null (session survives tournament archival)", () => {
		expect(fkByColumn("tournament_id")?.onDelete).toBe("set null");
	});

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("has exactly 4 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(4);
	});

	it("all foreign keys reference id columns", () => {
		for (const fk of config.foreignKeys) {
			expect(fk.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
		}
	});
});

describe("LiveTournamentSession — indexes", () => {
	const config = getTableConfig(liveTournamentSession);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has userId index", () => {
		expect(idxNames).toContain("liveTournamentSession_userId_idx");
	});

	it("has status index for finding active sessions", () => {
		expect(idxNames).toContain("liveTournamentSession_status_idx");
	});

	it("has storeId index", () => {
		expect(idxNames).toContain("liveTournamentSession_storeId_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("LiveTournamentSession — defaults and modes", () => {
	const columns = getTableColumns(liveTournamentSession);

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("timerStartedAt uses timestamp mode", () => {
		expect(columns.timerStartedAt.dataType).toBe("date");
	});

	it("startedAt is not null and endedAt is nullable (can be still running)", () => {
		expect(columns.startedAt.notNull).toBe(true);
		expect(columns.endedAt.notNull).toBe(false);
	});

	it("buyIn and entryFee are integer columns (nullable)", () => {
		expect(columns.buyIn.dataType).toBe("number");
		expect(columns.entryFee.dataType).toBe("number");
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.entryFee.notNull).toBe(false);
	});

	it("heroSeatPosition is nullable", () => {
		expect(columns.heroSeatPosition.notNull).toBe(false);
	});
});
