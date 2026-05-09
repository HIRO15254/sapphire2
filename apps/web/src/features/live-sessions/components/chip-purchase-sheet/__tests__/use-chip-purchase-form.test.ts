import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChipPurchaseForm } from "@/features/live-sessions/components/chip-purchase-sheet/use-chip-purchase-form";

describe("useChipPurchaseForm", () => {
	it("defaults to empty chipPurchaseOptionId when nothing is provided", () => {
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit: vi.fn() })
		);
		expect(result.current.form.state.values).toEqual({
			chipPurchaseOptionId: "",
		});
	});

	it("initialises with provided initialOptionId", () => {
		const { result } = renderHook(() =>
			useChipPurchaseForm({
				open: false,
				onSubmit: vi.fn(),
				initialOptionId: "42",
			})
		);
		expect(result.current.form.state.values).toEqual({
			chipPurchaseOptionId: "42",
		});
	});

	it("rejects submission when chipPurchaseOptionId is empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit })
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with a valid chipPurchaseOptionId", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useChipPurchaseForm({ open: false, onSubmit })
		);
		act(() => {
			result.current.form.setFieldValue("chipPurchaseOptionId", "7");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({ chipPurchaseOptionId: "7" });
	});

	it("resets to initialOptionId when `open` transitions to true", () => {
		const onSubmit = vi.fn();
		const { result, rerender } = renderHook(
			(p: { open: boolean; initialOptionId?: string }) =>
				useChipPurchaseForm({ ...p, onSubmit }),
			{ initialProps: { open: false, initialOptionId: "1" } }
		);
		// First mutate the field
		act(() => {
			result.current.form.setFieldValue("chipPurchaseOptionId", "99");
		});
		// Then open again — should reset back to initialOptionId
		rerender({ open: true, initialOptionId: "1" });
		expect(result.current.form.state.values.chipPurchaseOptionId).toBe("1");
	});

	it("resets to empty string when open transitions and no initialOptionId", () => {
		const onSubmit = vi.fn();
		const { result, rerender } = renderHook(
			(p: { open: boolean }) => useChipPurchaseForm({ ...p, onSubmit }),
			{ initialProps: { open: false } }
		);
		act(() => {
			result.current.form.setFieldValue("chipPurchaseOptionId", "5");
		});
		rerender({ open: true });
		expect(result.current.form.state.values.chipPurchaseOptionId).toBe("");
	});
});
