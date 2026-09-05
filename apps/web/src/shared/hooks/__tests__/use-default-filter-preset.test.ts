import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the data hook this one composes. `useFilterPresets` owns the tRPC query
// (covered by its own test); here we only drive its observable outputs
// (`isLoading`, `isSuccess`, `defaultPreset`) so the one-shot auto-apply effect
// can be tested in isolation. `defaultPreset` is derived from the configured
// rows the same way the real hook derives it, so "no rows" and "rows but none
// default" stay honest scenarios rather than hand-set nulls.
// ---------------------------------------------------------------------------

interface PresetRow {
	id: string;
	isDefault: boolean;
	name: string;
	payload: Record<string, unknown>;
}

const mocks = vi.hoisted(() => ({
	useFilterPresets: vi.fn(),
}));

vi.mock("@/shared/hooks/use-filter-presets", () => ({
	useFilterPresets: mocks.useFilterPresets,
}));

import { useDefaultFilterPreset } from "@/shared/hooks/use-default-filter-preset";

/**
 * Drives the mocked query state honestly, mirroring TanStack Query: a query
 * that is still loading has not answered (`isSuccess` false), and one that has
 * stopped loading answered successfully — unless the caller says otherwise via
 * `setErrored()`, which is the "retries exhausted, no data" state.
 */
function setPresets(
	rows: PresetRow[],
	isLoading = false,
	isSuccess = !isLoading
) {
	mocks.useFilterPresets.mockReturnValue({
		presets: rows,
		defaultPreset: rows.find((r) => r.isDefault) ?? null,
		isLoading,
		isSuccess,
	});
}

/**
 * The list query finished with an error: `isLoading` is false (the retries are
 * spent, `isPending` flipped off) but no data ever arrived, so `isSuccess` is
 * false and `defaultPreset` is null.
 */
function setErrored() {
	setPresets([], false, false);
}

const DEFAULT_ROW: PresetRow = {
	id: "p2",
	name: "My default",
	payload: { type: "cash_game", period: "30d" },
	isDefault: true,
};

const PLAIN_ROW: PresetRow = {
	id: "p1",
	name: "Not default",
	payload: { type: "tournament" },
	isDefault: false,
};

describe("useDefaultFilterPreset", () => {
	beforeEach(() => {
		mocks.useFilterPresets.mockReset();
		setPresets([]);
	});

	it("passes the screenKey through to useFilterPresets", () => {
		setPresets([]);
		renderHook(() => useDefaultFilterPreset("statistics", true, vi.fn()));
		expect(mocks.useFilterPresets).toHaveBeenCalledWith("statistics");
	});

	describe("loading gate", () => {
		it("does not call applyDefault while the presets query is still loading", () => {
			const applyDefault = vi.fn();
			setPresets([DEFAULT_ROW], true);
			renderHook(() => useDefaultFilterPreset("sessions", true, applyDefault));
			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("calls applyDefault once the loading flag flips to false", () => {
			const applyDefault = vi.fn();
			setPresets([DEFAULT_ROW], true);
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, applyDefault)
			);
			expect(applyDefault).not.toHaveBeenCalled();

			setPresets([DEFAULT_ROW], false);
			rerender();

			expect(applyDefault).toHaveBeenCalledTimes(1);
			expect(applyDefault).toHaveBeenCalledWith(DEFAULT_ROW.payload);
		});
	});

	describe("no default to apply", () => {
		it("does not call applyDefault when the user has no presets at all", () => {
			const applyDefault = vi.fn();
			setPresets([]);
			renderHook(() => useDefaultFilterPreset("sessions", true, applyDefault));
			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("does not call applyDefault when presets exist but none is marked default", () => {
			const applyDefault = vi.fn();
			setPresets([PLAIN_ROW, { ...PLAIN_ROW, id: "p3", name: "Other" }]);
			renderHook(() => useDefaultFilterPreset("sessions", true, applyDefault));
			expect(applyDefault).not.toHaveBeenCalled();
		});
	});

	describe("applying the default", () => {
		it("calls applyDefault exactly once with the default preset's payload", () => {
			const applyDefault = vi.fn();
			setPresets([PLAIN_ROW, DEFAULT_ROW]);
			renderHook(() => useDefaultFilterPreset("sessions", true, applyDefault));
			expect(applyDefault).toHaveBeenCalledTimes(1);
			expect(applyDefault).toHaveBeenCalledWith(DEFAULT_ROW.payload);
		});

		it("does not call applyDefault when the caller reports the screen as touched", () => {
			const applyDefault = vi.fn();
			setPresets([DEFAULT_ROW]);
			renderHook(() => useDefaultFilterPreset("sessions", false, applyDefault));
			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("does not re-apply on a plain re-render after a successful apply", () => {
			const applyDefault = vi.fn();
			setPresets([DEFAULT_ROW]);
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, applyDefault)
			);
			rerender();
			rerender();
			expect(applyDefault).toHaveBeenCalledTimes(1);
		});
	});

	describe("failed first fetch", () => {
		it("does not call applyDefault when the first fetch errored out", () => {
			const applyDefault = vi.fn();
			setErrored();
			renderHook(() => useDefaultFilterPreset("sessions", true, applyDefault));
			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("applies the default from a later successful refetch after the first fetch errored", () => {
			// A failed fetch must not spend the one shot: on a flaky connection the
			// first load errors, then a window-focus / reconnect refetch succeeds and
			// the stored default still has to be applied.
			const applyDefault = vi.fn();
			setErrored();
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, applyDefault)
			);
			expect(applyDefault).not.toHaveBeenCalled();

			setPresets([PLAIN_ROW, DEFAULT_ROW]);
			rerender();

			expect(applyDefault).toHaveBeenCalledTimes(1);
			expect(applyDefault).toHaveBeenCalledWith(DEFAULT_ROW.payload);
		});

		it("applies exactly once across a loading → error → loading → success sequence", () => {
			const applyDefault = vi.fn();
			setPresets([], true);
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, applyDefault)
			);

			setErrored();
			rerender();
			expect(applyDefault).not.toHaveBeenCalled();

			// Background refetch in flight: still no answer, still a no-op.
			setPresets([], true);
			rerender();
			expect(applyDefault).not.toHaveBeenCalled();

			setPresets([DEFAULT_ROW]);
			rerender();
			rerender();

			expect(applyDefault).toHaveBeenCalledTimes(1);
			expect(applyDefault).toHaveBeenCalledWith(DEFAULT_ROW.payload);
		});
	});

	describe("one-shot attempt semantics", () => {
		it("spends the attempt on a successful empty answer, so a later default never applies", () => {
			// The contrast with the errored-first-fetch case above: an empty list is
			// a real answer ("you have no default"), so the one shot is spent and a
			// preset marked default later must not clobber the user's filters.
			const applyDefault = vi.fn();
			setPresets([]);
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, applyDefault)
			);
			expect(applyDefault).not.toHaveBeenCalled();

			setPresets([DEFAULT_ROW]);
			rerender();

			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("never applies a default preset that arrives after the attempt already ran", () => {
			// The attempt is marked as spent regardless of outcome: a preset that
			// becomes default later (another tab, a refetch) must not silently
			// overwrite filters the user has been using since load.
			const applyDefault = vi.fn();
			setPresets([PLAIN_ROW]);
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, applyDefault)
			);
			expect(applyDefault).not.toHaveBeenCalled();

			setPresets([PLAIN_ROW, DEFAULT_ROW]);
			rerender();

			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("never applies when isUntouched flips to true after the attempt already ran", () => {
			const applyDefault = vi.fn();
			setPresets([DEFAULT_ROW]);
			const { rerender } = renderHook(
				({ isUntouched }: { isUntouched: boolean }) =>
					useDefaultFilterPreset("sessions", isUntouched, applyDefault),
				{ initialProps: { isUntouched: false } }
			);
			expect(applyDefault).not.toHaveBeenCalled();

			rerender({ isUntouched: true });

			expect(applyDefault).not.toHaveBeenCalled();
		});

		it("does not apply a second time when isUntouched flips to false and back to true", () => {
			const applyDefault = vi.fn();
			setPresets([DEFAULT_ROW]);
			const { rerender } = renderHook(
				({ isUntouched }: { isUntouched: boolean }) =>
					useDefaultFilterPreset("sessions", isUntouched, applyDefault),
				{ initialProps: { isUntouched: true } }
			);
			expect(applyDefault).toHaveBeenCalledTimes(1);

			rerender({ isUntouched: false });
			rerender({ isUntouched: true });

			expect(applyDefault).toHaveBeenCalledTimes(1);
		});

		it("does not re-apply when the applyDefault callback identity changes every render", () => {
			// Callers pass an inline lambda, so the effect's dependency array
			// changes on every render — the ref guard, not memoization, is what
			// keeps this a one-shot.
			setPresets([DEFAULT_ROW]);
			const applied: unknown[] = [];
			const { rerender } = renderHook(() =>
				useDefaultFilterPreset("sessions", true, (payload) => {
					applied.push(payload);
				})
			);
			rerender();
			rerender();
			expect(applied).toEqual([DEFAULT_ROW.payload]);
		});
	});
});
