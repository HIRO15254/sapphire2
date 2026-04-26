import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRingGameRow } from "@/features/stores/hooks/use-ring-game-row";

describe("useRingGameRow", () => {
	describe("initial state", () => {
		it("returns confirmingDelete=false regardless of initial expanded value", () => {
			const expandedHook = renderHook(() => useRingGameRow({ expanded: true }));
			expect(expandedHook.result.current.confirmingDelete).toBe(false);
			const collapsedHook = renderHook(() =>
				useRingGameRow({ expanded: false })
			);
			expect(collapsedHook.result.current.confirmingDelete).toBe(false);
		});

		it("exposes a setter to mutate confirmingDelete", () => {
			const { result } = renderHook(() => useRingGameRow({ expanded: true }));
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			expect(result.current.confirmingDelete).toBe(true);
		});
	});

	describe("collapse resets confirmingDelete", () => {
		it("resets confirmingDelete to false when expanded transitions true -> false", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useRingGameRow({ expanded }),
				{ initialProps: { expanded: true } }
			);
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			expect(result.current.confirmingDelete).toBe(true);

			rerender({ expanded: false });
			expect(result.current.confirmingDelete).toBe(false);
		});

		it("does not reset when rerendering with the same expanded=true", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useRingGameRow({ expanded }),
				{ initialProps: { expanded: true } }
			);
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			rerender({ expanded: true });
			expect(result.current.confirmingDelete).toBe(true);
		});

		it("keeps confirmingDelete=false across a false -> false rerender", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useRingGameRow({ expanded }),
				{ initialProps: { expanded: false } }
			);
			rerender({ expanded: false });
			expect(result.current.confirmingDelete).toBe(false);
		});

		it("allows re-entering confirming mode after a reset cycle", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useRingGameRow({ expanded }),
				{ initialProps: { expanded: true } }
			);
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			rerender({ expanded: false });
			expect(result.current.confirmingDelete).toBe(false);
			rerender({ expanded: true });
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			expect(result.current.confirmingDelete).toBe(true);
		});
	});
});
