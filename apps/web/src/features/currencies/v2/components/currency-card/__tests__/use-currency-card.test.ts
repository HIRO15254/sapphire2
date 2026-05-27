import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCurrencyCardV2 } from "@/features/currencies/v2/components/currency-card/use-currency-card";

describe("useCurrencyCardV2", () => {
	describe("initial state", () => {
		it("starts with confirmingDelete=false", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: false })
			);
			expect(result.current.confirmingDelete).toBe(false);
		});
	});

	describe("handleStartDelete", () => {
		it("sets confirmingDelete=true", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: true })
			);
			act(() => result.current.handleStartDelete());
			expect(result.current.confirmingDelete).toBe(true);
		});
	});

	describe("handleCancelDelete", () => {
		it("resets confirmingDelete back to false", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: true })
			);
			act(() => result.current.handleStartDelete());
			act(() => result.current.handleCancelDelete());
			expect(result.current.confirmingDelete).toBe(false);
		});
	});

	describe("handleConfirmDelete", () => {
		it("invokes onDelete exactly once", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: true })
			);
			const onDelete = vi.fn();
			act(() => result.current.handleConfirmDelete(onDelete));
			expect(onDelete).toHaveBeenCalledTimes(1);
		});

		it("resets confirmingDelete to false after firing", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: true })
			);
			act(() => result.current.handleStartDelete());
			expect(result.current.confirmingDelete).toBe(true);
			act(() => result.current.handleConfirmDelete(vi.fn()));
			expect(result.current.confirmingDelete).toBe(false);
		});
	});

	describe("handleToggleExpanded", () => {
		it("expands when collapsed by forwarding true to onExpandChange", () => {
			const onExpandChange = vi.fn();
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: false, onExpandChange })
			);
			act(() => result.current.handleToggleExpanded());
			expect(onExpandChange).toHaveBeenCalledTimes(1);
			expect(onExpandChange).toHaveBeenCalledWith(true);
		});

		it("collapses when expanded by forwarding false to onExpandChange", () => {
			const onExpandChange = vi.fn();
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: true, onExpandChange })
			);
			act(() => result.current.handleToggleExpanded());
			expect(onExpandChange).toHaveBeenCalledTimes(1);
			expect(onExpandChange).toHaveBeenCalledWith(false);
		});

		it("resets confirmingDelete when collapsing", () => {
			const { result, rerender } = renderHook(
				({ isExpanded }: { isExpanded: boolean }) =>
					useCurrencyCardV2({ isExpanded }),
				{ initialProps: { isExpanded: true } }
			);
			act(() => result.current.handleStartDelete());
			expect(result.current.confirmingDelete).toBe(true);
			act(() => result.current.handleToggleExpanded());
			expect(result.current.confirmingDelete).toBe(false);
			rerender({ isExpanded: false });
			expect(result.current.confirmingDelete).toBe(false);
		});

		it("keeps confirmingDelete when expanding (only collapsing clears it)", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: false })
			);
			act(() => result.current.handleStartDelete());
			act(() => result.current.handleToggleExpanded());
			expect(result.current.confirmingDelete).toBe(true);
		});

		it("does not throw when onExpandChange is omitted", () => {
			const { result } = renderHook(() =>
				useCurrencyCardV2({ isExpanded: false })
			);
			expect(() =>
				act(() => result.current.handleToggleExpanded())
			).not.toThrow();
		});
	});
});
