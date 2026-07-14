import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import { ringGame } from "../schema/ring-game";

describe("RingGame schema", () => {
	it("has required columns", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.id).toBeDefined();
		expect(columns.roomId).toBeDefined();
		expect(columns.name).toBeDefined();
		expect(columns.variant).toBeDefined();
		expect(columns.blind1).toBeDefined();
		expect(columns.blind2).toBeDefined();
		expect(columns.blind3).toBeDefined();
		expect(columns.ante).toBeDefined();
		expect(columns.anteType).toBeDefined();
		expect(columns.minBuyIn).toBeDefined();
		expect(columns.maxBuyIn).toBeDefined();
		expect(columns.tableSize).toBeDefined();
		expect(columns.currencyId).toBeDefined();
		expect(columns.userId).toBeDefined();
		expect(columns.memo).toBeDefined();
		expect(columns.archivedAt).toBeDefined();
		expect(columns.createdAt).toBeDefined();
		expect(columns.updatedAt).toBeDefined();
	});

	it("anteType is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.anteType.notNull).toBe(false);
	});

	it("id is primary key", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.id.primary).toBe(true);
	});

	it("roomId is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.roomId.notNull).toBe(false);
	});

	it("userId is nullable (DB-level; app sets it on every insert, SA2-181)", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.userId.notNull).toBe(false);
	});

	it("name is not null", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.name.notNull).toBe(true);
	});

	it("variant is not null", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.variant.notNull).toBe(true);
	});

	it("blind1 is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.blind1.notNull).toBe(false);
	});

	it("blind2 is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.blind2.notNull).toBe(false);
	});

	it("blind3 is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.blind3.notNull).toBe(false);
	});

	it("currencyId is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.currencyId.notNull).toBe(false);
	});

	it("archivedAt is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.archivedAt.notNull).toBe(false);
	});

	it("memo is nullable", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.memo.notNull).toBe(false);
	});
});

describe("RingGame — defaults", () => {
	const columns = getTableColumns(ringGame);

	it("variant defaults to DEFAULT_VARIANT_LABEL (c12: not the stale 'nlh' key)", () => {
		expect(columns.variant.hasDefault).toBe(true);
		expect(columns.variant.default).toBe(DEFAULT_VARIANT_LABEL);
	});

	it("createdAt has a default", () => {
		expect(columns.createdAt.hasDefault).toBe(true);
	});

	it("updatedAt uses $onUpdate", () => {
		expect(columns.updatedAt.notNull).toBe(true);
		expect(columns.updatedAt.onUpdateFn).toBeInstanceOf(Function);
	});

	it("archivedAt is timestamp mode", () => {
		expect(columns.archivedAt.dataType).toBe("date");
	});

	it("blind1/blind2/blind3/ante/minBuyIn/maxBuyIn/tableSize are integers", () => {
		expect(columns.blind1.dataType).toBe("number");
		expect(columns.blind2.dataType).toBe("number");
		expect(columns.blind3.dataType).toBe("number");
		expect(columns.ante.dataType).toBe("number");
		expect(columns.minBuyIn.dataType).toBe("number");
		expect(columns.maxBuyIn.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
	});
});

describe("RingGame — FK cascade policies", () => {
	const config = getTableConfig(ringGame);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("roomId FK cascades on room deletion", () => {
		expect(fkByColumn("room_id")?.onDelete).toBe("cascade");
	});

	it("currencyId FK uses set null", () => {
		expect(fkByColumn("currency_id")?.onDelete).toBe("set null");
	});

	it("userId FK cascades on user deletion (SA2-181)", () => {
		expect(fkByColumn("user_id")?.onDelete).toBe("cascade");
	});

	it("userId FK references the user id column (SA2-181)", () => {
		const fk = fkByColumn("user_id")?.reference();
		expect(fk?.foreignColumns.map((c) => c.name)).toEqual(["id"]);
		expect(getTableConfig(fk?.foreignTable as never).name).toBe("user");
	});

	it("has exactly 3 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(3);
	});
});

describe("RingGame — indexes", () => {
	const config = getTableConfig(ringGame);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has roomId index for per-room ring-game listing", () => {
		expect(idxNames).toContain("ringGame_roomId_idx");
	});

	it("has userId index for owner-scoped queries (SA2-181)", () => {
		expect(idxNames).toContain("ringGame_userId_idx");
	});

	it("has no unique indexes (ring games can share names within a room)", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});

	it("has no composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(0);
	});

	it("mixGames is a nullable JSON column for mix game groups", () => {
		const columns = getTableColumns(ringGame);
		expect(columns.mixGames).toBeDefined();
		expect(columns.mixGames.notNull).toBe(false);
		expect(columns.mixGames.columnType).toBe("SQLiteTextJson");
	});
});
