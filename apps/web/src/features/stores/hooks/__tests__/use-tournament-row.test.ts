import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTournamentRow } from "@/features/stores/hooks/use-tournament-row";

describe("useTournamentRow", () => {
	describe("initial state", () => {
		it("returns confirmingDelete=false initially for both expanded and collapsed", () => {
			const expandedHook = renderHook(() =>
				useTournamentRow({ expanded: true })
			);
			expect(expandedHook.result.current.confirmingDelete).toBe(false);
			const collapsedHook = renderHook(() =>
				useTournamentRow({ expanded: false })
			);
			expect(collapsedHook.result.current.confirmingDelete).toBe(false);
		});

		it("exposes a setter to toggle confirmingDelete", () => {
			const { result } = renderHook(() => useTournamentRow({ expanded: true }));
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			expect(result.current.confirmingDelete).toBe(true);
		});
	});

	describe("collapse resets confirmingDelete", () => {
		it("resets confirmingDelete on expanded true -> false transition", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useTournamentRow({ expanded }),
				{ initialProps: { expanded: true } }
			);
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			rerender({ expanded: false });
			expect(result.current.confirmingDelete).toBe(false);
		});

		it("does not reset confirmingDelete on true -> true rerender", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useTournamentRow({ expanded }),
				{ initialProps: { expanded: true } }
			);
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			rerender({ expanded: true });
			expect(result.current.confirmingDelete).toBe(true);
		});

		it("allows setting confirmingDelete back to true when expanded again after reset", () => {
			const { result, rerender } = renderHook(
				({ expanded }: { expanded: boolean }) => useTournamentRow({ expanded }),
				{ initialProps: { expanded: true } }
			);
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			rerender({ expanded: false });
			rerender({ expanded: true });
			act(() => {
				result.current.setConfirmingDelete(true);
			});
			expect(result.current.confirmingDelete).toBe(true);
		});
	});
});
