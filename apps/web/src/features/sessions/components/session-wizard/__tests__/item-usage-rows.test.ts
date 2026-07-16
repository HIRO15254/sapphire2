import { describe, expect, it } from "vitest";
import { toItemUsageRows, toSessionItemUsages } from "../item-usage-rows";

describe("toItemUsageRows", () => {
	it("returns an empty array for no usages", () => {
		expect(toItemUsageRows([])).toEqual([]);
	});

	it("adapts usages to string-cell rows with stable uids", () => {
		const rows = toItemUsageRows([
			{ itemId: "i1", direction: "buy_in", count: 2 },
			{ itemId: "i2", direction: "cash_out", count: 1 },
		]);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			itemId: "i1",
			direction: "buy_in",
			count: "2",
		});
		expect(rows[1]).toMatchObject({
			itemId: "i2",
			direction: "cash_out",
			count: "1",
		});
		expect(rows[0]?.uid).not.toBe(rows[1]?.uid);
	});
});

describe("toSessionItemUsages", () => {
	const row = (
		overrides: Partial<{
			count: string;
			direction: "buy_in" | "cash_out";
			itemId: string;
			uid: string;
		}> = {}
	) => ({
		uid: "u1",
		itemId: "i1",
		direction: "buy_in" as const,
		count: "2",
		...overrides,
	});

	it("parses complete rows back to payload inputs", () => {
		expect(toSessionItemUsages([row()])).toEqual([
			{ itemId: "i1", direction: "buy_in", count: 2 },
		]);
	});

	it("drops rows with no item picked", () => {
		expect(toSessionItemUsages([row({ itemId: "" })])).toEqual([]);
	});

	it("drops rows with an empty, zero, negative, or non-integer count", () => {
		for (const count of ["", "0", "-1", "1.5", "abc"]) {
			expect(toSessionItemUsages([row({ count })])).toEqual([]);
		}
	});

	it("keeps valid rows while dropping invalid ones", () => {
		expect(
			toSessionItemUsages([
				row(),
				row({ uid: "u2", itemId: "" }),
				row({ uid: "u3", itemId: "i3", direction: "cash_out", count: "1" }),
			])
		).toEqual([
			{ itemId: "i1", direction: "buy_in", count: 2 },
			{ itemId: "i3", direction: "cash_out", count: 1 },
		]);
	});
});
