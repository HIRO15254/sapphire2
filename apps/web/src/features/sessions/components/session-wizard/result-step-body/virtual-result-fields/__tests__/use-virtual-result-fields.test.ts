import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	items: [] as unknown[],
}));

vi.mock("@/features/items/hooks/use-items", () => ({
	useItems: () => ({ items: mocks.items }),
}));

import type { ItemUsageRow } from "@/features/sessions/components/session-wizard/item-usage-rows";
import { useVirtualResultFields } from "../use-virtual-result-fields";

function renderFields(options: {
	itemUsages?: ItemUsageRow[];
	selectedCurrencyId?: string;
}) {
	const setItemUsages = vi.fn();
	const view = renderHook(() =>
		useVirtualResultFields({
			itemUsages: options.itemUsages ?? [],
			selectedCurrencyId: options.selectedCurrencyId,
			setItemUsages,
		})
	);
	return { ...view, setItemUsages };
}

const ROW: ItemUsageRow = {
	uid: "u1",
	itemId: "i1",
	direction: "buy_in",
	count: "2",
};

describe("useVirtualResultFields", () => {
	it("offers only items matching the selected currency", () => {
		mocks.items = [
			{ id: "i1", name: "Ticket", currencyId: "c1", unitValue: 1000 },
			{ id: "i2", name: "Voucher", currencyId: "c2", unitValue: 500 },
		];
		const { result } = renderFields({ selectedCurrencyId: "c1" });
		expect(result.current.itemOptions).toEqual([{ id: "i1", name: "Ticket" }]);
	});

	it("offers no items when no currency is selected (fail closed)", () => {
		mocks.items = [
			{ id: "i1", name: "Ticket", currencyId: "c1", unitValue: 1000 },
		];
		const { result } = renderFields({ selectedCurrencyId: undefined });
		expect(result.current.itemOptions).toEqual([]);
	});

	it("addRow appends a fresh buy-in row with count 1", () => {
		const { result, setItemUsages } = renderFields({
			itemUsages: [ROW],
			selectedCurrencyId: "c1",
		});
		result.current.addRow();
		expect(setItemUsages).toHaveBeenCalledTimes(1);
		const next = setItemUsages.mock.calls[0]?.[0] as ItemUsageRow[];
		expect(next).toHaveLength(2);
		expect(next[1]).toMatchObject({
			itemId: "",
			direction: "buy_in",
			count: "1",
		});
		expect(next[1]?.uid).not.toBe(ROW.uid);
	});

	it("removeRow drops only the targeted row", () => {
		const other: ItemUsageRow = { ...ROW, uid: "u2" };
		const { result, setItemUsages } = renderFields({
			itemUsages: [ROW, other],
			selectedCurrencyId: "c1",
		});
		result.current.removeRow("u1");
		expect(setItemUsages).toHaveBeenCalledTimes(1);
		expect(setItemUsages).toHaveBeenNthCalledWith(1, [other]);
	});

	it("updateRow patches only the targeted row", () => {
		const other: ItemUsageRow = { ...ROW, uid: "u2" };
		const { result, setItemUsages } = renderFields({
			itemUsages: [ROW, other],
			selectedCurrencyId: "c1",
		});
		result.current.updateRow("u1", { direction: "cash_out", count: "3" });
		expect(setItemUsages).toHaveBeenCalledTimes(1);
		expect(setItemUsages).toHaveBeenNthCalledWith(1, [
			{ ...ROW, direction: "cash_out", count: "3" },
			other,
		]);
	});
});
