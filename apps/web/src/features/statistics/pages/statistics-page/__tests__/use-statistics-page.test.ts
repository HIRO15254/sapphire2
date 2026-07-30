import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";

interface PresetStub {
	id: string;
	isDefault: boolean;
	payload: Record<string, unknown>;
}

const mocks = vi.hoisted(() => ({
	filters: { period: "all", norm: "normalized", type: "all" } as StatsFilters,
	isFilterStateDefault: false,
	isScopeValid: true,
	replaceFilters: vi.fn(),
	setFilters: vi.fn(),
	statsInput: {} as Record<string, unknown>,
	normalized: true,
	currencies: [] as { id: string; unit: string | null }[],
	presets: [] as PresetStub[],
	defaultPreset: null as PresetStub | null,
	isPresetsLoading: false,
	lastPresetsScreenKey: undefined as string | undefined,
	defaultPresetCalls: [] as Array<{
		applyDefault: (payload: Record<string, unknown>) => void;
		isUntouched: boolean;
		screenKey: string;
	}>,
}));

vi.mock("@/features/statistics/hooks/use-stats-filters", () => ({
	useStatsFilters: () => ({
		filters: mocks.filters,
		setFilters: mocks.setFilters,
		replaceFilters: mocks.replaceFilters,
		statsInput: mocks.statsInput,
		normalized: mocks.normalized,
		isScopeValid: mocks.isScopeValid,
		isFilterStateDefault: mocks.isFilterStateDefault,
	}),
}));

vi.mock("@/features/statistics/hooks/use-stats-reference-data", () => ({
	useStatsReferenceData: () => ({
		currencies: mocks.currencies,
		rooms: [],
		isLoading: false,
	}),
}));

// Only the fields the shared auto-apply hook actually reads are stubbed: the
// page hook no longer touches the preset CRUD surface at all (the presets sheet
// mounts its own `useFilterPresets`), which the removal test below locks in.
// `isSuccess` is derived from the loading flag rather than set independently so
// the stub cannot express the impossible "loading and already succeeded" state —
// the auto-apply latch keys on isSuccess precisely so a FAILED query (stopped
// loading, never answered) does not spend the one shot.
vi.mock("@/shared/hooks/use-filter-presets", () => ({
	useFilterPresets: (screenKey: string) => {
		mocks.lastPresetsScreenKey = screenKey;
		return {
			presets: mocks.presets,
			defaultPreset: mocks.defaultPreset,
			isLoading: mocks.isPresetsLoading,
			isSuccess: !mocks.isPresetsLoading,
		};
	},
}));

// Spy wrapper, not a replacement: the real shared hook still runs (so the
// loading gate / one-shot guard is exercised end-to-end through the page hook),
// while every call records the `screenKey` + `isUntouched` verdict this hook
// computed and the `applyDefault` it handed over, for direct invocation.
vi.mock("@/shared/hooks/use-default-filter-preset", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/shared/hooks/use-default-filter-preset")
		>();
	return {
		useDefaultFilterPreset: (
			screenKey: "sessions" | "statistics",
			isUntouched: boolean,
			applyDefault: (payload: Record<string, unknown>) => void
		) => {
			mocks.defaultPresetCalls.push({ applyDefault, isUntouched, screenKey });
			return actual.useDefaultFilterPreset(
				screenKey,
				isUntouched,
				applyDefault
			);
		},
	};
});

import { useStatisticsPage } from "@/features/statistics/pages/statistics-page/use-statistics-page";

function lastDefaultPresetCall() {
	const call = mocks.defaultPresetCalls.at(-1);
	if (!call) {
		throw new Error("useDefaultFilterPreset was never called");
	}
	return call;
}

describe("useStatisticsPage", () => {
	beforeEach(() => {
		mocks.filters = { period: "all", norm: "normalized", type: "all" };
		mocks.isFilterStateDefault = false;
		mocks.isScopeValid = true;
		mocks.replaceFilters.mockReset();
		mocks.setFilters.mockReset();
		mocks.statsInput = {};
		mocks.normalized = true;
		mocks.currencies = [];
		mocks.presets = [];
		mocks.defaultPreset = null;
		mocks.isPresetsLoading = false;
		mocks.lastPresetsScreenKey = undefined;
		mocks.defaultPresetCalls = [];
	});

	describe("ctx / scope", () => {
		it("resolves the currency unit for the selected currency", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				currency: "c1",
			};
			mocks.currencies = [{ id: "c1", unit: "$" }];
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.ctx.currencyUnit).toBe("$");
		});

		it("is null when no currency matches the selected id", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				currency: "missing",
			};
			mocks.currencies = [{ id: "c1", unit: "$" }];
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.ctx.currencyUnit).toBeNull();
		});

		it("forwards statsInput, normalized, type, and enabled into ctx", () => {
			mocks.filters = { period: "all", norm: "normalized", type: "tournament" };
			mocks.statsInput = { normalized: true };
			mocks.normalized = true;
			mocks.isScopeValid = true;
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.ctx.statsInput).toBe(mocks.statsInput);
			expect(result.current.ctx.normalized).toBe(true);
			expect(result.current.ctx.type).toBe("tournament");
			expect(result.current.ctx.enabled).toBe(true);
		});

		it("disables ctx when the scope is invalid", () => {
			mocks.isScopeValid = false;
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.ctx.enabled).toBe(false);
		});

		it("shows only the tournament block when type is tournament", () => {
			mocks.filters = { period: "all", norm: "off", type: "tournament" };
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.showCashBlock).toBe(false);
			expect(result.current.showTournamentBlock).toBe(true);
		});

		it("shows only the cash block when type is cash_game", () => {
			mocks.filters = { period: "all", norm: "off", type: "cash_game" };
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.showCashBlock).toBe(true);
			expect(result.current.showTournamentBlock).toBe(false);
		});

		it("shows both blocks for type all", () => {
			mocks.filters = { period: "all", norm: "off", type: "all" };
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.showCashBlock).toBe(true);
			expect(result.current.showTournamentBlock).toBe(true);
		});

		it("forwards isScopeValid", () => {
			mocks.isScopeValid = false;
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.isScopeValid).toBe(false);
		});
	});

	describe("filter presets", () => {
		it("subscribes to the statistics screen's presets through the shared hook", () => {
			renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().screenKey).toBe("statistics");
			expect(mocks.lastPresetsScreenKey).toBe("statistics");
		});

		// The preset CRUD surface is self-contained in FilterPresetsSheet ->
		// useFilterPresetsSheet -> useFilterPresets; re-exporting it here left ten
		// fields no consumer ever read (review finding 3). statistics-page.tsx only
		// destructures { ctx, isScopeValid, showCashBlock, showTournamentBlock }.
		it("does not re-export the preset list or CRUD surface", () => {
			mocks.presets = [{ id: "p1", isDefault: true, payload: {} }];
			mocks.defaultPreset = mocks.presets[0];
			const { result } = renderHook(() => useStatisticsPage());
			const returned = result.current as Record<string, unknown>;
			for (const key of [
				"presets",
				"defaultPreset",
				"isPresetsLoading",
				"isCreatePresetPending",
				"isDeletePresetPending",
				"isSetDefaultPresetPending",
				"createPreset",
				"removePreset",
				"setDefaultPreset",
				"clearDefaultPreset",
			]) {
				expect(returned[key]).toBeUndefined();
			}
		});

		it("exposes exactly the four members the page component consumes", () => {
			const { result } = renderHook(() => useStatisticsPage());
			expect(Object.keys(result.current).sort()).toEqual([
				"ctx",
				"isScopeValid",
				"showCashBlock",
				"showTournamentBlock",
			]);
		});
	});

	describe("isUntouched verdict passed to useDefaultFilterPreset", () => {
		it("is true when the raw URL search object is bare", () => {
			mocks.isFilterStateDefault = true;
			renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().isUntouched).toBe(true);
		});

		it("is false when the URL carries explicit search params", () => {
			mocks.isFilterStateDefault = false;
			renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().isUntouched).toBe(false);
		});

		// The verdict must come from `isFilterStateDefault` (the RAW, pre-validateSearch
		// search object), never from `filters`: Zod bakes defaults into `filters`,
		// so a shared link like /statistics?type=all&norm=normalized is
		// indistinguishable from a bare load there — and auto-applying a default
		// preset over it would clobber the link the user actually opened.
		it("is false for an explicit link whose params happen to equal the schema defaults", () => {
			mocks.isFilterStateDefault = false;
			mocks.filters = { period: "all", norm: "normalized", type: "all" };
			renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().isUntouched).toBe(false);
		});

		it("is true on a bare URL even when filters hold non-default values", () => {
			mocks.isFilterStateDefault = true;
			mocks.filters = {
				period: "30d",
				norm: "off",
				type: "cash_game",
				currency: "c1",
				room: "r1",
			};
			renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().isUntouched).toBe(true);
		});

		it("tracks isFilterStateDefault flipping between renders", () => {
			mocks.isFilterStateDefault = true;
			const { rerender } = renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().isUntouched).toBe(true);

			mocks.isFilterStateDefault = false;
			rerender();
			expect(lastDefaultPresetCall().isUntouched).toBe(false);
		});
	});

	describe("apply function passed to useDefaultFilterPreset", () => {
		it("is the full-replace applier from useStatsFilters, not the merging setFilters", () => {
			renderHook(() => useStatisticsPage());
			expect(lastDefaultPresetCall().applyDefault).toBe(mocks.replaceFilters);
		});

		it("replaces the URL with the stored payload verbatim when invoked", () => {
			renderHook(() => useStatisticsPage());
			act(() => {
				lastDefaultPresetCall().applyDefault({
					type: "tournament",
					room: "r9",
				});
			});
			expect(mocks.replaceFilters).toHaveBeenCalledTimes(1);
			expect(mocks.replaceFilters).toHaveBeenCalledWith({
				type: "tournament",
				room: "r9",
			});
			expect(mocks.setFilters).not.toHaveBeenCalled();
		});

		// A preset saved by an older/newer build can hold a value this build's
		// search schema rejects. The page hook must hand it over untouched;
		// degrading safely is `replaceFilters`' job (it safeParses and no-ops).
		it("hands over payload values this build may not understand without filtering them", () => {
			renderHook(() => useStatisticsPage());
			act(() => {
				lastDefaultPresetCall().applyDefault({ period: "last_month" });
			});
			expect(mocks.replaceFilters).toHaveBeenCalledTimes(1);
			expect(mocks.replaceFilters).toHaveBeenCalledWith({
				period: "last_month",
			});
		});
	});

	describe("auto-apply default preset on first load", () => {
		it("applies the default preset via a full replace when the URL is empty", async () => {
			mocks.isFilterStateDefault = true;
			mocks.defaultPreset = {
				id: "p1",
				isDefault: true,
				payload: { type: "tournament" },
			};
			renderHook(() => useStatisticsPage());
			await waitFor(() =>
				expect(mocks.replaceFilters).toHaveBeenCalledTimes(1)
			);
			expect(mocks.replaceFilters).toHaveBeenCalledWith({
				type: "tournament",
			});
			expect(mocks.setFilters).not.toHaveBeenCalled();
		});

		it("does not apply when the URL already carries explicit search params", async () => {
			mocks.isFilterStateDefault = false;
			mocks.defaultPreset = {
				id: "p1",
				isDefault: true,
				payload: { type: "tournament" },
			};
			renderHook(() => useStatisticsPage());
			await Promise.resolve();
			expect(mocks.replaceFilters).not.toHaveBeenCalled();
		});

		it("does not apply when there is no default preset", async () => {
			mocks.isFilterStateDefault = true;
			mocks.defaultPreset = null;
			renderHook(() => useStatisticsPage());
			await Promise.resolve();
			expect(mocks.replaceFilters).not.toHaveBeenCalled();
		});

		it("defers while the presets query is loading, then fires exactly once after it resolves", async () => {
			mocks.isFilterStateDefault = true;
			mocks.isPresetsLoading = true;
			mocks.defaultPreset = null;
			const { rerender } = renderHook(() => useStatisticsPage());
			await Promise.resolve();
			expect(mocks.replaceFilters).not.toHaveBeenCalled();

			mocks.isPresetsLoading = false;
			mocks.defaultPreset = {
				id: "p1",
				isDefault: true,
				payload: { room: "r9" },
			};
			rerender();
			await waitFor(() =>
				expect(mocks.replaceFilters).toHaveBeenCalledTimes(1)
			);
			expect(mocks.replaceFilters).toHaveBeenCalledWith({ room: "r9" });

			rerender();
			await Promise.resolve();
			expect(mocks.replaceFilters).toHaveBeenCalledTimes(1);
		});

		it("fires at most once even if the default preset changes identity afterwards", async () => {
			mocks.isFilterStateDefault = true;
			mocks.defaultPreset = {
				id: "p1",
				isDefault: true,
				payload: { type: "cash_game" },
			};
			const { rerender } = renderHook(() => useStatisticsPage());
			await waitFor(() =>
				expect(mocks.replaceFilters).toHaveBeenCalledTimes(1)
			);

			mocks.defaultPreset = {
				id: "p2",
				isDefault: true,
				payload: { type: "tournament" },
			};
			rerender();
			await Promise.resolve();
			expect(mocks.replaceFilters).toHaveBeenCalledTimes(1);
		});

		it("never applies a default that only becomes non-empty after the one-shot attempt", async () => {
			mocks.isFilterStateDefault = true;
			mocks.isPresetsLoading = false;
			mocks.defaultPreset = null;
			const { rerender } = renderHook(() => useStatisticsPage());
			await Promise.resolve();

			mocks.defaultPreset = {
				id: "p1",
				isDefault: true,
				payload: { type: "tournament" },
			};
			rerender();
			await Promise.resolve();
			expect(mocks.replaceFilters).not.toHaveBeenCalled();
		});
	});
});
