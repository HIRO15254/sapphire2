import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePlayerFilters } from "@/features/players/components/player-filters/use-player-filters";

describe("usePlayerFilters", () => {
	it("seeds draft from selectedTagIds and starts closed", () => {
		const onTagIdsChange = vi.fn();
		const { result } = renderHook(() =>
			usePlayerFilters({ selectedTagIds: ["t1", "t2"], onTagIdsChange })
		);
		expect(result.current.isOpen).toBe(false);
		expect(result.current.draft).toEqual(["t1", "t2"]);
	});

	it("onOpen resets draft from the latest selectedTagIds and opens the sheet", () => {
		const onTagIdsChange = vi.fn();
		const { result, rerender } = renderHook(
			({ selected }: { selected: string[] }) =>
				usePlayerFilters({ selectedTagIds: selected, onTagIdsChange }),
			{ initialProps: { selected: ["t1"] } }
		);
		// Dirty the draft, then change selectedTagIds, then open.
		act(() => {
			result.current.toggleTag("t-extra");
		});
		rerender({ selected: ["t-real"] });
		act(() => {
			result.current.onOpen();
		});
		expect(result.current.isOpen).toBe(true);
		expect(result.current.draft).toEqual(["t-real"]);
	});

	it("toggleTag adds a tag when absent and removes it when present", () => {
		const onTagIdsChange = vi.fn();
		const { result } = renderHook(() =>
			usePlayerFilters({ selectedTagIds: ["t1"], onTagIdsChange })
		);
		act(() => {
			result.current.toggleTag("t2");
		});
		expect(result.current.draft).toEqual(["t1", "t2"]);
		act(() => {
			result.current.toggleTag("t1");
		});
		expect(result.current.draft).toEqual(["t2"]);
	});

	it("onApply commits the draft and closes", () => {
		const onTagIdsChange = vi.fn();
		const { result } = renderHook(() =>
			usePlayerFilters({ selectedTagIds: ["t1"], onTagIdsChange })
		);
		act(() => {
			result.current.onOpen();
			result.current.toggleTag("t2");
		});
		act(() => {
			result.current.onApply();
		});
		expect(onTagIdsChange).toHaveBeenCalledWith(["t1", "t2"]);
		expect(result.current.isOpen).toBe(false);
	});

	it("onReset clears draft, calls onTagIdsChange with [], and closes", () => {
		const onTagIdsChange = vi.fn();
		const { result } = renderHook(() =>
			usePlayerFilters({ selectedTagIds: ["t1", "t2"], onTagIdsChange })
		);
		act(() => {
			result.current.onOpen();
		});
		act(() => {
			result.current.onReset();
		});
		expect(result.current.draft).toEqual([]);
		expect(onTagIdsChange).toHaveBeenCalledWith([]);
		expect(result.current.isOpen).toBe(false);
	});

	it("onOpenChange(false) closes; onOpenChange(true) does not re-open", () => {
		const onTagIdsChange = vi.fn();
		const { result } = renderHook(() =>
			usePlayerFilters({ selectedTagIds: [], onTagIdsChange })
		);
		act(() => {
			result.current.onOpen();
		});
		expect(result.current.isOpen).toBe(true);
		act(() => {
			result.current.onOpenChange(false);
		});
		expect(result.current.isOpen).toBe(false);
		act(() => {
			result.current.onOpenChange(true);
		});
		// Per the hook: onOpenChange only acts on false.
		expect(result.current.isOpen).toBe(false);
	});
});
