import { describe, expect, it } from "vitest";
import {
	toChipPurchaseRows,
	toSessionChipPurchases,
} from "../chip-purchase-rows";

describe("toChipPurchaseRows", () => {
	it("returns empty rows and counts for no purchases", () => {
		expect(toChipPurchaseRows([])).toEqual({ rows: [], counts: {} });
	});

	it("stringifies non-zero numeric cells", () => {
		const { rows } = toChipPurchaseRows([
			{ name: "Rebuy", cost: 50, chips: 10_000 },
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			name: "Rebuy",
			cost: "50",
			chips: "10000",
		});
	});

	it("maps zero cost and chips to empty strings", () => {
		const { rows } = toChipPurchaseRows([{ name: "Free", cost: 0, chips: 0 }]);
		expect(rows[0]).toMatchObject({ name: "Free", cost: "", chips: "" });
	});

	it("assigns a unique uid to every row", () => {
		const { rows } = toChipPurchaseRows([
			{ name: "A", cost: 1, chips: 1 },
			{ name: "B", cost: 2, chips: 2 },
		]);
		expect(rows[0].uid).toBeTruthy();
		expect(rows[0].uid).not.toBe(rows[1].uid);
	});

	it("maps each purchase count to its row uid", () => {
		const { rows, counts } = toChipPurchaseRows([
			{ name: "Rebuy", cost: 50, chips: 10_000, count: 3 },
			{ name: "Add-on", cost: 30, chips: 5000, count: 1 },
		]);
		expect(counts[rows[0].uid]).toBe(3);
		expect(counts[rows[1].uid]).toBe(1);
	});

	it("defaults count to 0 when a purchase has no count", () => {
		const { rows, counts } = toChipPurchaseRows([
			{ name: "Rebuy", cost: 50, chips: 10_000 },
		]);
		expect(counts[rows[0].uid]).toBe(0);
	});
});

describe("toSessionChipPurchases", () => {
	it("returns an empty array for no rows", () => {
		expect(toSessionChipPurchases([])).toEqual([]);
	});

	it("parses numeric strings, strips the uid, and reads the count", () => {
		expect(
			toSessionChipPurchases(
				[{ uid: "u1", name: "Rebuy", cost: "50", chips: "10000" }],
				{ u1: 2 }
			)
		).toEqual([{ name: "Rebuy", cost: 50, chips: 10_000, count: 2 }]);
	});

	it("defaults count to 0 when the uid is absent from the counts map", () => {
		expect(
			toSessionChipPurchases([
				{ uid: "u1", name: "Rebuy", cost: "50", chips: "10000" },
			])
		).toEqual([{ name: "Rebuy", cost: 50, chips: 10_000, count: 0 }]);
	});

	it("treats empty cells as zero", () => {
		expect(
			toSessionChipPurchases([{ uid: "u1", name: "Free", cost: "", chips: "" }])
		).toEqual([{ name: "Free", cost: 0, chips: 0, count: 0 }]);
	});

	it("treats non-numeric cells as zero", () => {
		expect(
			toSessionChipPurchases([
				{ uid: "u1", name: "Bad", cost: "abc", chips: "xyz" },
			])
		).toEqual([{ name: "Bad", cost: 0, chips: 0, count: 0 }]);
	});

	it("does not truncate decimal, partial, infinite, or unsafe integer cells", () => {
		expect(
			toSessionChipPurchases([
				{
					uid: "u1",
					name: "Bad",
					cost: "1.5",
					chips: "12abc",
				},
				{
					uid: "u2",
					name: "Bad",
					cost: "Infinity",
					chips: "9007199254740992",
				},
			])
		).toEqual([
			{ name: "Bad", cost: 0, chips: 0, count: 0 },
			{ name: "Bad", cost: 0, chips: 0, count: 0 },
		]);
	});

	it("maps negative cells to zero for non-negative API fields", () => {
		expect(
			toSessionChipPurchases([
				{ uid: "u1", name: "Negative", cost: "-1", chips: "-2" },
			])
		).toEqual([{ name: "Negative", cost: 0, chips: 0, count: 0 }]);
	});

	it("round-trips through toChipPurchaseRows preserving counts", () => {
		const original = [{ name: "Rebuy", cost: 50, chips: 10_000, count: 4 }];
		const { rows, counts } = toChipPurchaseRows(original);
		expect(toSessionChipPurchases(rows, counts)).toEqual(original);
	});
});
