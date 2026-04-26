import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChipPurchaseForm } from "@/features/live-sessions/components/chip-purchase-sheet/use-chip-purchase-form";

describe("useChipPurchaseForm", () => {
	it("defaults to empty name and '0' for cost/chips when nothing is provided", () => {
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit: vi.fn() })
		);
		expect(result.current.form.state.values).toEqual({
			name: "",
			cost: "0",
			chips: "0",
		});
	});

	it("prefers initialValues over default* props", () => {
		const { result } = renderHook(() =>
			useChipPurchaseForm({
				open: false,
				onSubmit: vi.fn(),
				defaultName: "Rebuy",
				defaultCost: 10,
				defaultChips: 5000,
				initialValues: { name: "Addon", cost: 20, chips: 6000 },
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Addon",
			cost: "20",
			chips: "6000",
		});
	});

	it("falls back to default* props when initialValues is undefined", () => {
		const { result } = renderHook(() =>
			useChipPurchaseForm({
				open: false,
				onSubmit: vi.fn(),
				defaultName: "Rebuy",
				defaultCost: 10,
				defaultChips: 5000,
			})
		);
		expect(result.current.form.state.values).toEqual({
			name: "Rebuy",
			cost: "10",
			chips: "5000",
		});
	});

	it("rejects submission when name is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("cost", "10");
			result.current.form.setFieldValue("chips", "100");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits rounded numeric cost/chips on valid input", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("name", "Rebuy");
			result.current.form.setFieldValue("cost", "15");
			result.current.form.setFieldValue("chips", "3000");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			name: "Rebuy",
			cost: 15,
			chips: 3000,
		});
	});

	it("rounds fractional numeric inputs (Math.round) at submit", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("name", "X");
			result.current.form.setFieldValue("cost", "12.6");
			result.current.form.setFieldValue("chips", "4.4");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		// Schema uses parseInt for integer rules, then Math.round is applied on
		// submit. Fractional inputs go through and are rounded to ints.
		expect(onSubmit).toHaveBeenCalledWith({ name: "X", cost: 13, chips: 4 });
	});

	it("reapplies initialValues when `open` transitions", () => {
		const onSubmit = vi.fn();
		const { result, rerender } = renderHook(
			(p: {
				open: boolean;
				initialValues?: { name: string; cost: number; chips: number };
			}) => useChipPurchaseForm({ ...p, onSubmit }),
			{
				initialProps: {
					open: false,
					initialValues: { name: "A", cost: 1, chips: 100 },
				},
			}
		);
		rerender({
			open: true,
			initialValues: { name: "B", cost: 2, chips: 200 },
		});
		expect(result.current.form.state.values).toEqual({
			name: "B",
			cost: "2",
			chips: "200",
		});
	});
});
