import { useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import {
	filtersToStatsInput,
	isCurrencyScopeValid,
	type StatsFilters,
	type StatsQueryInput,
	statsSearchSchema,
} from "@/features/statistics/utils/stats-filters";

export interface UseStatsFiltersResult {
	filters: StatsFilters;
	isScopeValid: boolean;
	/**
	 * True only when the router's RAW (pre-`validateSearch`) location search
	 * object carries no keys at all — i.e. a genuinely bare `/statistics` load.
	 * `filters` above always has Zod defaults baked in (e.g. `period: "all"`),
	 * so it can't distinguish "user never touched the URL" from "user
	 * explicitly navigated to a URL whose params happen to match the
	 * defaults" — this flag is read from `useRouterState`'s un-defaulted
	 * search instead, specifically so callers (the default-preset auto-apply
	 * effect) never clobber an explicit, bookmarked, or shared link.
	 */
	isUrlEmpty: boolean;
	normalized: boolean;
	/**
	 * Fully replaces the URL search params with `payload` — unlike
	 * `setFilters`, fields the payload omits fall back to the schema's own
	 * defaults rather than whatever was previously in the URL. Used for
	 * applying a saved filter preset, where a preset that doesn't mention
	 * `room` must actually clear a previously-set room, not merge over it.
	 */
	replaceFilters: (payload: Partial<StatsFilters>) => void;
	setFilters: (patch: Partial<StatsFilters>) => void;
	statsInput: StatsQueryInput;
}

/**
 * Bridges the `/statistics` route search params to typed filter state. All
 * parsing / derivation lives in `utils/stats-filters.ts` (unit-tested there);
 * this hook only reads `useSearch` and writes back through `useNavigate`, so
 * reloads and shared URLs restore the exact filter state.
 */
export function useStatsFilters(): UseStatsFiltersResult {
	const filters = useSearch({ from: "/statistics" });
	const navigate = useNavigate({ from: "/statistics" });
	const rawSearch = useRouterState({ select: (s) => s.location.search });
	const isUrlEmpty = Object.keys(rawSearch).length === 0;

	const setFilters = (patch: Partial<StatsFilters>) => {
		navigate({ search: (prev) => ({ ...prev, ...patch }) });
	};

	const replaceFilters = (payload: Partial<StatsFilters>) => {
		// Re-parse through the schema so any field the caller's payload omits
		// (rather than being copied from `prev`) resolves to its own default.
		//
		// safeParse, not parse: the payload can come from a SAVED filter preset,
		// whose stored vocabulary is looser than this schema's (packages/db
		// validates `period` as a bounded string because it can't import apps/web's
		// PERIODS — see schemas/filter-preset.ts). A preset holding a period this
		// build no longer knows must degrade to "keep the current filters", not
		// throw — replaceFilters runs inside the default-preset auto-apply effect
		// during mount, where a throw would take the whole page down.
		const parsed = statsSearchSchema.safeParse(payload);
		if (!parsed.success) {
			return;
		}
		navigate({ search: () => parsed.data });
	};

	return {
		filters,
		setFilters,
		replaceFilters,
		statsInput: filtersToStatsInput(filters),
		normalized: filters.norm !== "off",
		isScopeValid: isCurrencyScopeValid(filters),
		isUrlEmpty,
	};
}
