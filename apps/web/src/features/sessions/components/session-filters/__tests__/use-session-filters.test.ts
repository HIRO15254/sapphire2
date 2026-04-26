import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionFilterValues } from "@/features/sessions/components/session-filters";
import { useSessionFilters } from "@/features/sessions/components/session-filters/use-session-filters";

describe("useSessionFilters", () => {
	it("exposes activeCount=0 and draft=filters initially (closed)", () => {
		const onFiltersChange = vi.fn();
		const filters: SessionFilterValues = {};
		const { result } = renderHook(() =>
			useSessionFilters({ filters, onFiltersChange })
		);
		expect(result.current.isOpen).toBe(false);
		expect(result.current.activeCount).toBe(0);
		expect(result.current.draft).toEqual({});
	});

	it("activeCount reflects the number of non-empty filter fields", () => {
		const onFiltersChange = vi.fn();
		const filters: SessionFilterValues = {
			type: "cash_game",
			storeId: "s1",
			dateFrom: "2026-01-01",
		};
		const { result } = renderHook(() =>
			useSessionFilters({ filters, onFiltersChange })
		);
		expect(result.current.activeCount).toBe(3);
	});

	it("onOpen resets draft from latest filters and opens", () => {
		const onFiltersChange = vi.fn();
		const { result, rerender } = renderHook(
			({ filters }: { filters: SessionFilterValues }) =>
				useSessionFilters({ filters, onFiltersChange }),
			{ initialProps: { filters: { type: "cash_game" } } }
		);
		act(() => {
			result.current.updateDraft({ storeId: "s1" });
		});
		rerender({ filters: { type: "tournament" } });
		act(() => {
			result.current.onOpen();
		});
		expect(result.current.isOpen).toBe(true);
		expect(result.current.draft).toEqual({ type: "tournament" });
	});

	it("updateDraft merges patches into draft", () => {
		const onFiltersChange = vi.fn();
		const { result } = renderHook(() =>
			useSessionFilters({
				filters: { type: "cash_game" },
				onFiltersChange,
			})
		);
		act(() => {
			result.current.updateDraft({ storeId: "s1" });
		});
		expect(result.current.draft).toEqual({ type: "cash_game", storeId: "s1" });
		act(() => {
			result.current.updateDraft({ dateFrom: "2026-01-01" });
		});
		expect(result.current.draft).toEqual({
			type: "cash_game",
			storeId: "s1",
			dateFrom: "2026-01-01",
		});
	});

	it("onApply commits the draft via onFiltersChange and closes", () => {
		const onFiltersChange = vi.fn();
		const { result } = renderHook(() =>
			useSessionFilters({ filters: {}, onFiltersChange })
		);
		act(() => {
			result.current.onOpen();
			result.current.updateDraft({ type: "tournament" });
		});
		act(() => {
			result.current.onApply();
		});
		expect(onFiltersChange).toHaveBeenCalledWith({ type: "tournament" });
		expect(result.current.isOpen).toBe(false);
	});

	it("onReset clears draft, calls onFiltersChange with {}, and closes", () => {
		const onFiltersChange = vi.fn();
		const { result } = renderHook(() =>
			useSessionFilters({
				filters: { type: "cash_game", storeId: "s1" },
				onFiltersChange,
			})
		);
		act(() => {
			result.current.onOpen();
		});
		act(() => {
			result.current.onReset();
		});
		expect(result.current.draft).toEqual({});
		expect(onFiltersChange).toHaveBeenCalledWith({});
		expect(result.current.isOpen).toBe(false);
	});

	it("onOpenChange(false) closes; onOpenChange(true) is a no-op", () => {
		const onFiltersChange = vi.fn();
		const { result } = renderHook(() =>
			useSessionFilters({ filters: {}, onFiltersChange })
		);
		act(() => {
			result.current.onOpen();
		});
		act(() => {
			result.current.onOpenChange(false);
		});
		expect(result.current.isOpen).toBe(false);
		act(() => {
			result.current.onOpenChange(true);
		});
		expect(result.current.isOpen).toBe(false);
	});
});
