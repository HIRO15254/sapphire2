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
	isUrlEmpty: false,
	isScopeValid: true,
	replaceFilters: vi.fn(),
	setFilters: vi.fn(),
	statsInput: {} as Record<string, unknown>,
	normalized: true,
	currencies: [] as { id: string; unit: string | null }[],
	presets: [] as PresetStub[],
	defaultPreset: null as PresetStub | null,
	isPresetsLoading: false,
	isCreatePending: false,
	isDeletePending: false,
	isSetDefaultPending: false,
	create: vi.fn(),
	remove: vi.fn(),
	setDefault: vi.fn(),
	clearDefault: vi.fn(),
}));

vi.mock("@/features/statistics/hooks/use-stats-filters", () => ({
	useStatsFilters: () => ({
		filters: mocks.filters,
		setFilters: mocks.setFilters,
		replaceFilters: mocks.replaceFilters,
		statsInput: mocks.statsInput,
		normalized: mocks.normalized,
		isScopeValid: mocks.isScopeValid,
		isUrlEmpty: mocks.isUrlEmpty,
	}),
}));

vi.mock("@/features/statistics/hooks/use-stats-reference-data", () => ({
	useStatsReferenceData: () => ({
		currencies: mocks.currencies,
		rooms: [],
		isLoading: false,
	}),
}));

vi.mock("@/shared/hooks/use-filter-presets", () => ({
	useFilterPresets: () => ({
		presets: mocks.presets,
		defaultPreset: mocks.defaultPreset,
		isLoading: mocks.isPresetsLoading,
		isCreatePending: mocks.isCreatePending,
		isDeletePending: mocks.isDeletePending,
		isSetDefaultPending: mocks.isSetDefaultPending,
		create: mocks.create,
		remove: mocks.remove,
		setDefault: mocks.setDefault,
		clearDefault: mocks.clearDefault,
	}),
}));

import { useStatisticsPage } from "@/features/statistics/pages/statistics-page/use-statistics-page";

describe("useStatisticsPage", () => {
	beforeEach(() => {
		mocks.filters = { period: "all", norm: "normalized", type: "all" };
		mocks.isUrlEmpty = false;
		mocks.isScopeValid = true;
		mocks.replaceFilters.mockReset();
		mocks.setFilters.mockReset();
		mocks.statsInput = {};
		mocks.normalized = true;
		mocks.currencies = [];
		mocks.presets = [];
		mocks.defaultPreset = null;
		mocks.isPresetsLoading = false;
		mocks.isCreatePending = false;
		mocks.isDeletePending = false;
		mocks.isSetDefaultPending = false;
		mocks.create.mockReset();
		mocks.remove.mockReset();
		mocks.setDefault.mockReset();
		mocks.clearDefault.mockReset();
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

	describe("presets passthrough", () => {
		it("forwards the preset list and default preset", () => {
			mocks.presets = [{ id: "p1", isDefault: true, payload: {} }];
			mocks.defaultPreset = mocks.presets[0];
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.presets).toEqual(mocks.presets);
			expect(result.current.defaultPreset).toEqual(mocks.presets[0]);
		});

		it("forwards the presets loading flag", () => {
			mocks.isPresetsLoading = true;
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.isPresetsLoading).toBe(true);
		});

		it("forwards create/delete/setDefault pending flags", () => {
			mocks.isCreatePending = true;
			mocks.isDeletePending = true;
			mocks.isSetDefaultPending = true;
			const { result } = renderHook(() => useStatisticsPage());
			expect(result.current.isCreatePresetPending).toBe(true);
			expect(result.current.isDeletePresetPending).toBe(true);
			expect(result.current.isSetDefaultPresetPending).toBe(true);
		});

		it("delegates createPreset to the shared hook's create", async () => {
			const { result } = renderHook(() => useStatisticsPage());
			await act(async () => {
				await result.current.createPreset({ name: "Cash BB", payload: {} });
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({
				name: "Cash BB",
				payload: {},
			});
		});

		it("delegates removePreset to the shared hook's remove", async () => {
			const { result } = renderHook(() => useStatisticsPage());
			await act(async () => {
				await result.current.removePreset("p1");
			});
			expect(mocks.remove).toHaveBeenCalledTimes(1);
			expect(mocks.remove).toHaveBeenCalledWith("p1");
		});

		it("delegates setDefaultPreset to the shared hook's setDefault", async () => {
			const { result } = renderHook(() => useStatisticsPage());
			await act(async () => {
				await result.current.setDefaultPreset("p1");
			});
			expect(mocks.setDefault).toHaveBeenCalledTimes(1);
			expect(mocks.setDefault).toHaveBeenCalledWith("p1");
		});

		it("delegates clearDefaultPreset to the shared hook's clearDefault", async () => {
			const { result } = renderHook(() => useStatisticsPage());
			await act(async () => {
				await result.current.clearDefaultPreset("p1");
			});
			expect(mocks.clearDefault).toHaveBeenCalledTimes(1);
			expect(mocks.clearDefault).toHaveBeenCalledWith("p1");
		});
	});

	describe("auto-apply default preset on first load", () => {
		it("applies the default preset via a full replace when the URL is empty", async () => {
			mocks.isUrlEmpty = true;
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
			mocks.isUrlEmpty = false;
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
			mocks.isUrlEmpty = true;
			mocks.defaultPreset = null;
			renderHook(() => useStatisticsPage());
			await Promise.resolve();
			expect(mocks.replaceFilters).not.toHaveBeenCalled();
		});

		it("defers while the presets query is loading, then fires exactly once after it resolves", async () => {
			mocks.isUrlEmpty = true;
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
			mocks.isUrlEmpty = true;
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
	});
});
