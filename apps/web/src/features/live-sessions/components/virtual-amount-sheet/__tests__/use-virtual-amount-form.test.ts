import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVirtualAmountForm } from "../use-virtual-amount-form";

const ITEMS = [
	{ id: "i1", name: "Tournament ticket", unitValue: 1000, currencyId: "c1" },
	{ id: "i2", name: "Voucher", unitValue: 500, currencyId: "c1" },
];

function renderForm(
	options: Partial<Parameters<typeof useVirtualAmountForm>[0]> = {}
) {
	const onSubmit = vi.fn();
	const view = renderHook(
		(props: Parameters<typeof useVirtualAmountForm>[0]) =>
			useVirtualAmountForm(props),
		{
			initialProps: {
				items: ITEMS,
				open: true,
				onSubmit,
				...options,
			},
		}
	);
	return { ...view, onSubmit };
}

describe("useVirtualAmountForm", () => {
	it("defaults to item mode with count 1", () => {
		const { result } = renderForm();
		expect(result.current.form.state.values).toEqual({
			mode: "item",
			itemId: "",
			count: "1",
			amount: "",
		});
		expect(result.current.hasItems).toBe(true);
	});

	it("submits an item payload with amount = count × unitValue", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			result.current.form.setFieldValue("itemId", "i1");
			result.current.form.setFieldValue("count", "2");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, {
			amount: 2000,
			itemId: "i1",
			itemName: "Tournament ticket",
			count: 2,
			unitValue: 1000,
			currencyId: "c1",
		});
	});

	it("rejects item mode without a selected item", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects item mode with count 0", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			result.current.form.setFieldValue("itemId", "i1");
			result.current.form.setFieldValue("count", "0");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects item mode with a non-integer count", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			result.current.form.setFieldValue("itemId", "i1");
			result.current.form.setFieldValue("count", "1.5");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits a pure-virtual payload in amount mode", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			result.current.form.setFieldValue("mode", "amount");
			result.current.form.setFieldValue("amount", "1500");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, {
			amount: 1500,
			itemId: null,
			itemName: null,
			count: null,
			unitValue: null,
			currencyId: null,
		});
	});

	it("rejects amount mode with an empty or zero amount", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			result.current.form.setFieldValue("mode", "amount");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();

		await act(async () => {
			result.current.form.setFieldValue("amount", "0");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("ignores stale amount errors when submitting in item mode", async () => {
		const { result, onSubmit } = renderForm();
		await act(async () => {
			result.current.form.setFieldValue("itemId", "i2");
			result.current.form.setFieldValue("count", "3");
			result.current.form.setFieldValue("amount", "not-a-number");
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenNthCalledWith(1, {
			amount: 1500,
			itemId: "i2",
			itemName: "Voucher",
			count: 3,
			unitValue: 500,
			currencyId: "c1",
		});
	});

	it("resets to defaults when reopened", () => {
		const { result, rerender, onSubmit } = renderForm();
		act(() => {
			result.current.form.setFieldValue("mode", "amount");
			result.current.form.setFieldValue("amount", "1500");
		});
		rerender({ items: ITEMS, open: false, onSubmit });
		rerender({ items: ITEMS, open: true, onSubmit });
		expect(result.current.form.state.values).toEqual({
			mode: "item",
			itemId: "",
			count: "1",
			amount: "",
		});
	});

	it("exposes hasItems false when no items match the session currency", () => {
		const { result } = renderForm({ items: [] });
		expect(result.current.hasItems).toBe(false);
	});
});
