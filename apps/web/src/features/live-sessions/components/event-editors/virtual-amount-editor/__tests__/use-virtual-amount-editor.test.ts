import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVirtualAmountEditor } from "@/features/live-sessions/components/event-editors/virtual-amount-editor/use-virtual-amount-editor";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

const ITEM_PAYLOAD = {
	amount: 2000,
	itemId: "i1",
	itemName: "Tournament ticket",
	count: 2,
	unitValue: 1000,
	currencyId: "c1",
};

const PURE_PAYLOAD = {
	amount: 500,
	itemId: null,
	itemName: null,
	count: null,
	unitValue: null,
	currencyId: null,
};

function event(
	payload: Record<string, unknown>,
	occurredAt = "2026-04-10T10:15:00"
): SessionEvent {
	return { id: "e1", eventType: "virtual_buy_in", payload, occurredAt };
}

function renderEditor(payload: Record<string, unknown>, onSubmit = vi.fn()) {
	const view = renderHook(() =>
		useVirtualAmountEditor({
			event: event(payload),
			isLoading: false,
			maxTime: null,
			minTime: null,
			onSubmit,
		})
	);
	return { ...view, onSubmit };
}

describe("useVirtualAmountEditor", () => {
	it("seeds count and item metadata for an item-based event", () => {
		const { result } = renderEditor(ITEM_PAYLOAD);
		expect(result.current.isItemBased).toBe(true);
		expect(result.current.itemName).toBe("Tournament ticket");
		expect(result.current.form.state.values).toEqual({
			time: "10:15",
			value: "2",
		});
	});

	it("seeds the amount for a pure-virtual event", () => {
		const { result } = renderEditor(PURE_PAYLOAD);
		expect(result.current.isItemBased).toBe(false);
		expect(result.current.form.state.values.value).toBe("500");
	});

	it("submits an updated item count with the recomputed amount and frozen snapshot", async () => {
		const { result, onSubmit } = renderEditor(ITEM_PAYLOAD);
		await act(async () => {
			result.current.form.setFieldValue("value", "3");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(
			1,
			{
				amount: 3000,
				itemId: "i1",
				itemName: "Tournament ticket",
				count: 3,
				unitValue: 1000,
				currencyId: "c1",
			},
			expect.any(Number)
		);
	});

	it("submits an updated pure amount with null item fields", async () => {
		const { result, onSubmit } = renderEditor(PURE_PAYLOAD);
		await act(async () => {
			result.current.form.setFieldValue("value", "750");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(
			1,
			{
				amount: 750,
				itemId: null,
				itemName: null,
				count: null,
				unitValue: null,
				currencyId: null,
			},
			expect.any(Number)
		);
	});

	it.each([["0"], ["-1"], ["1.5"], [""]])("rejects value %s", async (value) => {
		const { result, onSubmit } = renderEditor(ITEM_PAYLOAD);
		await act(async () => {
			result.current.form.setFieldValue("value", value);
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
