import { describe, expect, it } from "vitest";
import {
	toChipPurchaseRows,
	toSessionChipPurchases,
} from "../chip-purchase-rows";

describe("toChipPurchaseRows", () => {
	it("returns an empty array for no purchases", () => {
		expect(toChipPurchaseRows([])).toEqual([]);
	});

	it("stringifies non-zero numeric cells", () => {
		const rows = toChipPurchaseRows([
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
		const rows = toChipPurchaseRows([{ name: "Free", cost: 0, chips: 0 }]);
		expect(rows[0]).toMatchObject({ name: "Free", cost: "", chips: "" });
	});

	it("assigns a unique uid to every row", () => {
		const rows = toChipPurchaseRows([
			{ name: "A", cost: 1, chips: 1 },
			{ name: "B", cost: 2, chips: 2 },
		]);
		expect(rows[0].uid).toBeTruthy();
		expect(rows[0].uid).not.toBe(rows[1].uid);
	});
});

describe("toSessionChipPurchases", () => {
	it("returns an empty array for no rows", () => {
		expect(toSessionChipPurchases([])).toEqual([]);
	});

	it("parses numeric strings and strips the uid", () => {
		expect(
			toSessionChipPurchases([
				{ uid: "u1", name: "Rebuy", cost: "50", chips: "10000" },
			])
		).toEqual([{ name: "Rebuy", cost: 50, chips: 10_000 }]);
	});

	it("treats empty cells as zero", () => {
		expect(
			toSessionChipPurchases([{ uid: "u1", name: "Free", cost: "", chips: "" }])
		).toEqual([{ name: "Free", cost: 0, chips: 0 }]);
	});

	it("treats non-numeric cells as zero", () => {
		expect(
			toSessionChipPurchases([
				{ uid: "u1", name: "Bad", cost: "abc", chips: "xyz" },
			])
		).toEqual([{ name: "Bad", cost: 0, chips: 0 }]);
	});

	it("round-trips through toChipPurchaseRows", () => {
		const original = [{ name: "Rebuy", cost: 50, chips: 10_000 }];
		expect(toSessionChipPurchases(toChipPurchaseRows(original))).toEqual(
			original
		);
	});
});
