import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { gameSession } from "../schema/session";

describe("GameSession schema — columns", () => {
	const columns = getTableColumns(gameSession);

	it("has all required columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"userId",
				"kind",
				"status",
				"source",
				"sessionDate",
				"startedAt",
				"endedAt",
				"breakMinutes",
				"memo",
				"storeId",
				"currencyId",
				"heroSeatPosition",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("userId is not null", () => {
		expect(columns.userId.notNull).toBe(true);
	});

	it("kind is not null", () => {
		expect(columns.kind.notNull).toBe(true);
	});

	it("status is not null", () => {
		expect(columns.status.notNull).toBe(true);
	});

	it("source is not null", () => {
		expect(columns.source.notNull).toBe(true);
	});

	it("sessionDate is not null", () => {
		expect(columns.sessionDate.notNull).toBe(true);
	});

	it("nullable optional columns", () => {
		expect(columns.startedAt.notNull).toBe(false);
		expect(columns.endedAt.notNull).toBe(false);
		expect(columns.breakMinutes.notNull).toBe(false);
		expect(columns.memo.notNull).toBe(false);
		expect(columns.storeId.notNull).toBe(false);
		expect(columns.currencyId.notNull).toBe(false);
		expect(columns.heroSeatPosition.notNull).toBe(false);
	});

	it("createdAt and updatedAt are not null", () => {
		expect(columns.createdAt.notNull).toBe(true);
		expect(columns.updatedAt.notNull).toBe(true);
	});

	it("createdAt has a default (unixepoch)", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("sessionDate uses timestamp mode", () => {
		expect(columns.sessionDate.dataType).toBe("date");
	});

	it("startedAt / endedAt use timestamp mode", () => {
		expect(columns.startedAt.dataType).toBe("date");
		expect(columns.endedAt.dataType).toBe("date");
	});

	it("kind / status / source are stored as string", () => {
		expect(columns.kind.dataType).toBe("string");
		expect(columns.status.dataType).toBe("string");
		expect(columns.source.dataType).toBe("string");
	});

	it("heroSeatPosition is integer", () => {
		expect(columns.heroSeatPosition.dataType).toBe("number");
	});

	it("does not have old pokerSession columns (type, ringGameId, tournamentId, liveCashGameSessionId, liveTournamentSessionId)", () => {
		expect((columns as Record<string, unknown>).type).toBeUndefined();
		expect((columns as Record<string, unknown>).ringGameId).toBeUndefined();
		expect((columns as Record<string, unknown>).tournamentId).toBeUndefined();
		expect(
			(columns as Record<string, unknown>).liveCashGameSessionId
		).toBeUndefined();
		expect(
			(columns as Record<string, unknown>).liveTournamentSessionId
		).toBeUndefined();
	});
});

describe("GameSession — FK cascade policies", () => {
	const config = getTableConfig(gameSession);
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

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("has exactly 3 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(3);
	});

	it("all FK reference id columns", () => {
		for (const fk of config.foreignKeys) {
			expect(fk.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
		}
	});
});

describe("GameSession — indexes", () => {
	const config = getTableConfig(gameSession);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has session_user_kind_status_idx", () => {
		expect(idxNames).toContain("session_user_kind_status_idx");
	});

	it("has session_user_date_idx", () => {
		expect(idxNames).toContain("session_user_date_idx");
	});

	it("has session_store_idx", () => {
		expect(idxNames).toContain("session_store_idx");
	});

	it("has session_currency_idx", () => {
		expect(idxNames).toContain("session_currency_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("GameSession — table name", () => {
	it("table is named game_session", () => {
		const config = getTableConfig(gameSession);
		expect(config.name).toBe("game_session");
	});
});

describe("GameSession — CHECK constraint: manual source implies completed status", () => {
	it("has a check constraint", () => {
		const config = getTableConfig(gameSession);
		expect(config.checks.length).toBeGreaterThanOrEqual(1);
	});

	it("check constraint name is session_manual_completed_check", () => {
		const config = getTableConfig(gameSession);
		const ck = config.checks.find(
			(c) => c.name === "session_manual_completed_check"
		);
		expect(ck).toBeDefined();
	});
});
