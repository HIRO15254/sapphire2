import { describe, expect, it } from "vitest";
import {
	chipPurchaseProjection,
	computeChipPurchaseCounts,
} from "../chip-purchase";
import { makeChainableDb, makeEvent } from "./test-utils";

describe("computeChipPurchaseCounts — pure function", () => {
	it("returns empty map for empty events", () => {
		const result = computeChipPurchaseCounts([]);
		expect(result.size).toBe(0);
	});

	it("returns empty map when no purchase_chips events", () => {
		const result = computeChipPurchaseCounts([
			makeEvent("update_stack", { stackAmount: 5000 }),
			makeEvent("session_start", {}),
		]);
		expect(result.size).toBe(0);
	});

	it("counts a single purchase_chips event as count=1", () => {
		const result = computeChipPurchaseCounts([
			makeEvent("purchase_chips", { chipPurchaseOptionId: "10" }),
		]);
		expect(result.get(10)).toBe(1);
	});

	it("counts three purchase_chips events for same option as count=3", () => {
		const result = computeChipPurchaseCounts([
			makeEvent("purchase_chips", { chipPurchaseOptionId: "5" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "5" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "5" }),
		]);
		expect(result.get(5)).toBe(3);
	});

	it("counts multiple options independently", () => {
		const result = computeChipPurchaseCounts([
			makeEvent("purchase_chips", { chipPurchaseOptionId: "1" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "2" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "1" }),
		]);
		expect(result.get(1)).toBe(2);
		expect(result.get(2)).toBe(1);
	});

	it("ignores events with invalid payload gracefully", () => {
		const badEvent = {
			...makeEvent("purchase_chips", {}),
			payload: JSON.stringify({ notAnOptionId: "x" }),
		};
		const result = computeChipPurchaseCounts([badEvent]);
		expect(result.size).toBe(0);
	});
});

describe("chipPurchaseProjection — DB side effects", () => {
	it("deletes all records and inserts none when there are no purchase_chips events", async () => {
		const events = [makeEvent("session_start", {})];
		const db = makeChainableDb([events]);

		await chipPurchaseProjection(
			db as unknown as Parameters<typeof chipPurchaseProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("deletes all records and inserts count rows for valid option IDs", async () => {
		const events = [
			makeEvent("purchase_chips", { chipPurchaseOptionId: "7" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "7" }),
		];
		const options = [{ id: 7 }];
		const db = makeChainableDb([events, options]);

		await chipPurchaseProjection(
			db as unknown as Parameters<typeof chipPurchaseProjection>[0],
			"session-1"
		);

		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).toHaveBeenCalledTimes(1);
		const insertedRows = db._insertChain.values.mock.calls[0]?.[0] as unknown[];
		expect(insertedRows).toHaveLength(1);
		const row = insertedRows[0] as Record<string, unknown>;
		expect(row.chipPurchaseOptionId).toBe(7);
		expect(row.count).toBe(2);
		expect(row.sessionId).toBe("session-1");
	});

	it("inserts multiple option records when multiple options have purchases", async () => {
		const events = [
			makeEvent("purchase_chips", { chipPurchaseOptionId: "1" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "2" }),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "1" }),
		];
		const options = [{ id: 1 }, { id: 2 }];
		const db = makeChainableDb([events, options]);

		await chipPurchaseProjection(
			db as unknown as Parameters<typeof chipPurchaseProjection>[0],
			"session-1"
		);

		const insertedRows = db._insertChain.values.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>[];
		expect(insertedRows).toHaveLength(2);
		const row1 = insertedRows.find((r) => r.chipPurchaseOptionId === 1);
		const row2 = insertedRows.find((r) => r.chipPurchaseOptionId === 2);
		expect(row1?.count).toBe(2);
		expect(row2?.count).toBe(1);
	});

	it("skips inserting records for option IDs not in session options (orphan guard)", async () => {
		const events = [
			makeEvent("purchase_chips", { chipPurchaseOptionId: "99" }),
		];
		const options = [{ id: 1 }];
		const db = makeChainableDb([events, options]);

		await chipPurchaseProjection(
			db as unknown as Parameters<typeof chipPurchaseProjection>[0],
			"session-1"
		);

		expect(db.insert).not.toHaveBeenCalled();
	});

	it("is idempotent: delete-then-insert produces consistent count on repeated calls", async () => {
		const events = [makeEvent("purchase_chips", { chipPurchaseOptionId: "3" })];
		const options = [{ id: 3 }];

		for (let i = 0; i < 3; i++) {
			const db = makeChainableDb([events, options]);
			await chipPurchaseProjection(
				db as unknown as Parameters<typeof chipPurchaseProjection>[0],
				"session-1"
			);
			const rows = db._insertChain.values.mock.calls[0]?.[0] as Record<
				string,
				unknown
			>[];
			expect(rows[0]?.count).toBe(1);
		}
	});
});
