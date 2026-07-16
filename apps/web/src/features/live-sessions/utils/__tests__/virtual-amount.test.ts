import { describe, expect, it } from "vitest";
import {
	buildItemVirtualPayload,
	buildPureVirtualPayload,
	filterVirtualItemsForCurrency,
} from "../virtual-amount";

const TICKET = {
	id: "i1",
	name: "Tournament ticket",
	unitValue: 1000,
	currencyId: "c1",
};

describe("buildItemVirtualPayload", () => {
	it("computes amount as count × unitValue with full snapshot fields", () => {
		expect(buildItemVirtualPayload(TICKET, 2)).toEqual({
			amount: 2000,
			itemId: "i1",
			itemName: "Tournament ticket",
			count: 2,
			unitValue: 1000,
			currencyId: "c1",
		});
	});

	it("produces amount 0 for a zero-value item (still trackable)", () => {
		expect(
			buildItemVirtualPayload({ ...TICKET, unitValue: 0 }, 3)
		).toMatchObject({ amount: 0, count: 3, unitValue: 0 });
	});
});

describe("buildPureVirtualPayload", () => {
	it("nulls every item field and carries the amount", () => {
		expect(buildPureVirtualPayload(500)).toEqual({
			amount: 500,
			itemId: null,
			itemName: null,
			count: null,
			unitValue: null,
			currencyId: null,
		});
	});
});

describe("filterVirtualItemsForCurrency", () => {
	const items = [
		TICKET,
		{ id: "i2", name: "Voucher", unitValue: 500, currencyId: "c2" },
		{ id: "i3", name: "Chip", unitValue: 100, currencyId: null },
	];

	it("keeps only items denominated in the session currency", () => {
		expect(filterVirtualItemsForCurrency(items, "c1")).toEqual([TICKET]);
	});

	it("returns no items when the session has no currency (fail closed)", () => {
		expect(filterVirtualItemsForCurrency(items, null)).toEqual([]);
	});

	it("returns an empty array when nothing matches", () => {
		expect(filterVirtualItemsForCurrency(items, "c9")).toEqual([]);
	});
});
