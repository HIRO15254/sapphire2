import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { sessionCashBlindSet } from "../schema/session-cash-blind-set";

describe("SessionCashBlindSet schema — columns", () => {
	const columns = getTableColumns(sessionCashBlindSet);

	it("has all expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"sessionId",
				"limitFormatId",
				"blind1",
				"blind2",
				"blind3",
				"blind4",
				"ante",
				"anteType",
				"sortOrder",
			])
		);
	});

	it("id is auto-increment primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("sessionId is not null", () => {
		expect(columns.sessionId.notNull).toBe(true);
	});

	it("limitFormatId is not null (RESTRICT FK to master limit_format)", () => {
		expect(columns.limitFormatId.notNull).toBe(true);
	});

	it("blind1 and blind2 are not null (required minimums)", () => {
		expect(columns.blind1.notNull).toBe(true);
		expect(columns.blind2.notNull).toBe(true);
	});

	it("blind3, blind4, ante, anteType are nullable", () => {
		expect(columns.blind3.notNull).toBe(false);
		expect(columns.blind4.notNull).toBe(false);
		expect(columns.ante.notNull).toBe(false);
		expect(columns.anteType.notNull).toBe(false);
	});

	it("sortOrder defaults to 0", () => {
		expect(columns.sortOrder.hasDefault).toBe(true);
		expect(columns.sortOrder.default).toBe(0);
	});
});

describe("SessionCashBlindSet — FK cascade policies", () => {
	const config = getTableConfig(sessionCashBlindSet);
	const fkByColumn = (columnName: string) =>
		config.foreignKeys.find((fk) =>
			fk.reference().columns.some((c) => c.name === columnName)
		);

	it("sessionId FK cascades (blind sets die with their session)", () => {
		expect(fkByColumn("session_id")?.onDelete).toBe("cascade");
	});

	it("limit_format_id FK uses RESTRICT", () => {
		expect(fkByColumn("limit_format_id")?.onDelete).toBe("restrict");
	});

	it("has exactly 2 FKs", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});
});

describe("SessionCashBlindSet — UNIQUE constraint", () => {
	const config = getTableConfig(sessionCashBlindSet);

	it("has UNIQUE(session_id, sort_order)", () => {
		const uniq = config.uniqueConstraints.find(
			(u) =>
				u.columns.some((c) => c.name === "session_id") &&
				u.columns.some((c) => c.name === "sort_order")
		);
		expect(uniq).toBeDefined();
	});
});

describe("SessionCashBlindSet — table name", () => {
	it("table is named session_cash_blind_set", () => {
		const config = getTableConfig(sessionCashBlindSet);
		expect(config.name).toBe("session_cash_blind_set");
	});
});
