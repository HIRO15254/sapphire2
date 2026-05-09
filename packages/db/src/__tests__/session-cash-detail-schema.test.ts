import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionCashDetail } from "../schema/session-cash-detail";

describe("SessionCashDetail schema — columns", () => {
	const columns = getTableColumns(sessionCashDetail);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"sessionId",
				"ringGameId",
				"ruleName",
				"minBuyIn",
				"maxBuyIn",
				"tableSize",
				"variantId",
				"buyIn",
				"cashOut",
				"evCashOut",
			])
		);
	});

	it("does NOT have inline blind columns (moved to session_cash_blind_set)", () => {
		expect((columns as Record<string, unknown>).blind1).toBeUndefined();
		expect((columns as Record<string, unknown>).blind2).toBeUndefined();
		expect((columns as Record<string, unknown>).blind3).toBeUndefined();
		expect((columns as Record<string, unknown>).ante).toBeUndefined();
		expect((columns as Record<string, unknown>).anteType).toBeUndefined();
	});

	it("sessionId is primary key (PK=FK)", () => {
		expect(columns.sessionId.primary).toBe(true);
	});

	it("ringGameId is nullable (informational SET NULL)", () => {
		expect(columns.ringGameId.notNull).toBe(false);
	});

	it("ruleName is not null (required snapshot)", () => {
		expect(columns.ruleName.notNull).toBe(true);
	});

	it("minBuyIn / maxBuyIn / tableSize are nullable integers", () => {
		expect(columns.minBuyIn.notNull).toBe(false);
		expect(columns.maxBuyIn.notNull).toBe(false);
		expect(columns.tableSize.notNull).toBe(false);
		expect(columns.minBuyIn.dataType).toBe("number");
		expect(columns.maxBuyIn.dataType).toBe("number");
		expect(columns.tableSize.dataType).toBe("number");
	});

	it("variantId is not null (RESTRICT FK to variant master)", () => {
		expect(columns.variantId.notNull).toBe(true);
		expect(columns.variantId.dataType).toBe("number");
	});

	it("buyIn / cashOut / evCashOut are nullable result columns", () => {
		expect(columns.buyIn.notNull).toBe(false);
		expect(columns.cashOut.notNull).toBe(false);
		expect(columns.evCashOut.notNull).toBe(false);
		expect(columns.buyIn.dataType).toBe("number");
		expect(columns.cashOut.dataType).toBe("number");
		expect(columns.evCashOut.dataType).toBe("number");
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

	it("variantId FK uses restrict (variant deletion is blocked while referenced)", () => {
		expect(fkByColumn("variant_id")?.onDelete).toBe("restrict");
	});

	it("has exactly 3 foreign keys (session, ring_game, variant)", () => {
		expect(config.foreignKeys).toHaveLength(3);
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
});
