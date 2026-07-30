import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import { sessionCashDetail } from "../schema/session-cash-detail";

describe("SessionCashDetail schema — columns", () => {
	const columns = getTableColumns(sessionCashDetail);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"sessionId",
				"ringGameId",
				"buyIn",
				"cashOut",
				"evCashOut",
				"chipRemoveTotal",
				"ruleName",
				"variant",
				"blind1",
				"blind2",
				"blind3",
				"ante",
				"anteType",
				"minBuyIn",
				"maxBuyIn",
				"tableSize",
			])
		);
	});

	it("sessionId is primary key (PK=FK)", () => {
		expect(columns.sessionId.primary).toBe(true);
	});

	it("ringGameId is nullable", () => {
		expect(columns.ringGameId.notNull).toBe(false);
	});

	it("buyIn / cashOut / evCashOut / chipRemoveTotal are nullable", () => {
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.cashOut.notNull).toBe(false);
		expect(columns.evCashOut.notNull).toBe(false);
		expect(columns.chipRemoveTotal.notNull).toBe(false);
	});

	it("buyIn / cashOut / evCashOut / chipRemoveTotal are integer type", () => {
		expect(columns.buyIn.dataType).toBe("number");
		expect(columns.cashOut.dataType).toBe("number");
		expect(columns.evCashOut.dataType).toBe("number");
		expect(columns.chipRemoveTotal.dataType).toBe("number");
	});

	it("ringGameId is string type", () => {
		expect(columns.ringGameId.dataType).toBe("string");
	});

	it("ruleName and variant are NOT NULL (snapshot is forced on insert)", () => {
		expect(columns.ruleName.notNull).toBe(true);
		expect(columns.variant.notNull).toBe(true);
	});

	it("ruleName has default 'Untitled' so ADD COLUMN succeeds on existing rows", () => {
		expect(columns.ruleName.default).toBe("Untitled");
	});

	it("variant defaults to DEFAULT_VARIANT_LABEL so ADD COLUMN succeeds on existing rows (c12: not the stale 'nlh' key)", () => {
		expect(columns.variant.default).toBe(DEFAULT_VARIANT_LABEL);
	});

	it("blind / ante / size snapshot columns are nullable", () => {
		expect(columns.blind1.notNull).toBe(false);
		expect(columns.blind2.notNull).toBe(false);
		expect(columns.blind3.notNull).toBe(false);
		expect(columns.ante.notNull).toBe(false);
		expect(columns.anteType.notNull).toBe(false);
		expect(columns.minBuyIn.notNull).toBe(false);
		expect(columns.maxBuyIn.notNull).toBe(false);
		expect(columns.tableSize.notNull).toBe(false);
	});

	it("blind / ante / size snapshot columns have number/string dataType", () => {
		expect(columns.blind1.dataType).toBe("number");
		expect(columns.blind2.dataType).toBe("number");
		expect(columns.blind3.dataType).toBe("number");
		expect(columns.ante.dataType).toBe("number");
		expect(columns.anteType.dataType).toBe("string");
		expect(columns.minBuyIn.dataType).toBe("number");
		expect(columns.maxBuyIn.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
	});
});

describe("SessionCashDetail — FK cascade policies", () => {
	const config = getTableConfig(sessionCashDetail);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (detail dies with parent session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("ringGameId FK uses set null (detail survives ring game removal)", () => {
		expect(fkByColumn("ring_game_id")?.onDelete).toBe("set null");
	});

	it("has exactly 2 foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("sessionId FK references game_session.id", () => {
		const fk = fkByColumn("session_id");
		expect(fk?.reference().foreignColumns.map((c) => c.name)).toEqual(["id"]);
	});
});

describe("SessionCashDetail — indexes", () => {
	const config = getTableConfig(sessionCashDetail);
	const idxNames = config.indexes.map((i) => i.config.name);

	it("has session_cash_ring_idx for ring game lookups", () => {
		expect(idxNames).toContain("session_cash_ring_idx");
	});

	it("has no unique indexes", () => {
		const uniqueIdxs = config.indexes.filter(
			(i) => (i.config as unknown as { unique: boolean }).unique === true
		);
		expect(uniqueIdxs).toHaveLength(0);
	});
});

describe("SessionCashDetail — table name", () => {
	it("table is named session_cash_detail", () => {
		const config = getTableConfig(sessionCashDetail);
		expect(config.name).toBe("session_cash_detail");
	});

	it("mixGames is a nullable JSON column (frozen mix group snapshot)", () => {
		const columns = getTableColumns(sessionCashDetail);
		expect(columns.mixGames).toBeDefined();
		expect(columns.mixGames.notNull).toBe(false);
		expect(columns.mixGames.columnType).toBe("SQLiteTextJson");
	});
});
