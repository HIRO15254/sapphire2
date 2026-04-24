import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionTablePlayer } from "../schema/session-table-player";

describe("SessionTablePlayer schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.id).toBeDefined();
		expect(columns.playerId).toBeDefined();
		expect(columns.isActive).toBeDefined();
		expect(columns.joinedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("id is primary key", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.id.primary).toBe(true);
	});

	it("playerId is not null", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.playerId.notNull).toBe(true);
	});

	it("isActive is not null", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.isActive.notNull).toBe(true);
	});

	it("session reference columns are nullable", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.liveCashGameSessionId.notNull).toBe(false);
		expect(columns.liveTournamentSessionId.notNull).toBe(false);
	});

	it("leftAt is nullable", () => {
		const columns = getTableColumns(sessionTablePlayer);
		expect(columns.leftAt.notNull).toBe(false);
	});
});

describe("SessionTablePlayer — FK cascade policies", () => {
	const config = getTableConfig(sessionTablePlayer);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("liveCashGameSessionId FK cascades", () => {
		expect(fkByColumn("live_cash_game_session_id")?.onDelete).toBe("cascade");
	});

	it("liveTournamentSessionId FK cascades", () => {
		expect(fkByColumn("live_tournament_session_id")?.onDelete).toBe("cascade");
	});

	it("playerId FK cascades (seating rows die with the player record)", () => {
		expect(fkByColumn("player_id")?.onDelete).toBe("cascade");
	});

	it("has exactly 3 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(3);
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

	it("has liveCashGameSessionId index", () => {
		expect(idxNames).toContain("sessionTablePlayer_liveCashGameSessionId_idx");
	});

	it("has liveTournamentSessionId index", () => {
		expect(idxNames).toContain(
			"sessionTablePlayer_liveTournamentSessionId_idx"
		);
	});

	it("has playerId index for reverse lookups", () => {
		expect(idxNames).toContain("sessionTablePlayer_playerId_idx");
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
