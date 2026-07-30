import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the data hook this one composes. `useFilterPresets` owns the tRPC query
// (covered by its own test); here we only drive its two observable outputs
// (`isLoading`, `defaultPreset`) so the one-shot auto-apply effect can be
// tested in isolation. `defaultPreset` is derived from the configured rows the
// same way the real hook derives it, so "no rows" and "rows but none default"
// stay honest scenarios rather than hand-set nulls.
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

function setPresets(rows: PresetRow[], isLoading = false) {
	mocks.useFilterPresets.mockReturnValue({
		presets: rows,
		defaultPreset: rows.find((r) => r.isDefault) ?? null,
		isLoading,
	});
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

	it("returns undefined (side-effect-only hook)", () => {
		setPresets([DEFAULT_ROW]);
		const { result } = renderHook(() =>
			useDefaultFilterPreset("sessions", true, vi.fn())
		);
		expect(result.current).toBeUndefined();
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

	describe("one-shot attempt semantics", () => {
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
