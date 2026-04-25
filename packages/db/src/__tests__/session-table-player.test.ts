import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionTablePlayer } from "../schema/session-table-player";

describe("SessionTablePlayer schema — columns", () => {
	const columns = getTableColumns(sessionTablePlayer);

	it("has required columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"sessionId",
				"playerId",
				"seatPosition",
				"isActive",
				"joinedAt",
				"leftAt",
				"createdAt",
				"updatedAt",
			])
		);
	});

	it("id is primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is not null (single FK)", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("playerId is not null", () => {
		expect(columns.playerId.notNull).toBe(true);
	});

	it("isActive is not null", () => {
		expect(columns.isActive.notNull).toBe(true);
	});

	it("does NOT have liveCashGameSessionId column (old dual-FK removed)", () => {
		expect(
			(columns as Record<string, unknown>).liveCashGameSessionId
		).toBeUndefined();
	});

	it("does NOT have liveTournamentSessionId column (old dual-FK removed)", () => {
		expect(
			(columns as Record<string, unknown>).liveTournamentSessionId
		).toBeUndefined();
	});

	it("leftAt is nullable", () => {
		expect(columns.leftAt.notNull).toBe(false);
	});

	it("seatPosition is nullable", () => {
		expect(columns.seatPosition.notNull).toBe(false);
	});
});

describe("SessionTablePlayer — FK cascade policies", () => {
	const config = getTableConfig(sessionTablePlayer);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (seating rows die with the session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("playerId FK cascades (seating rows die with the player record)", () => {
		expect(fkByColumn("player_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 2 foreign keys (unified sessionId)", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("all foreign keys reference id columns", () => {
		for (const fk of config.foreignKeys) {
			expect(fk.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
		}
	});
});

describe("SessionTablePlayer — indexes", () => {
	const config = getTableConfig(sessionTablePlayer);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has sessionId index for per-session lookups", () => {
		expect(idxNames).toContain("sessionTablePlayer_sessionId_idx");
	});

	it("has playerId index for reverse lookups", () => {
		expect(idxNames).toContain("sessionTablePlayer_playerId_idx");
	});

	it("does NOT have old dual-FK indexes", () => {
		expect(idxNames).not.toContain(
			"sessionTablePlayer_liveCashGameSessionId_idx"
		);
		expect(idxNames).not.toContain(
			"sessionTablePlayer_liveTournamentSessionId_idx"
		);
	});

	it("has no unique indexes (a player may sit multiple times)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("SessionTablePlayer — defaults and column types", () => {
	const columns = getTableColumns(sessionTablePlayer);

	it("isActive defaults to 1 (true)", () => {
		expect(columns.isActive.hasDefault).toBe(true);
		expect(columns.isActive.default).toBe(1);
	});

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("joinedAt is timestamp mode and not null", () => {
		expect(columns.joinedAt.dataType).toBe("date");
		expect(columns.joinedAt.notNull).toBe(true);
	});

	it("leftAt is timestamp mode (nullable)", () => {
		expect(columns.leftAt.dataType).toBe("date");
	});

	it("seatPosition is a nullable integer", () => {
		expect(columns.seatPosition.notNull).toBe(false);
		expect(columns.seatPosition.dataType).toBe("number");
	});
});
