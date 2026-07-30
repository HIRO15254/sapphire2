import z from "zod";
import { PERIODS, resolveDateRange } from "@/shared/lib/period-filter";

// ── Filter value domains ─────────────────────────────────────────────────────

// Normalization is a single mode. "off" shows currency amounts (a currency
// must be selected); "normalized" shows big-blind (cash) and buy-in
// (tournament) normalized values SIMULTANEOUSLY. BB and BI live on different
// scales and must never be summed together, so any view that mixes cash and
// tournament sessions presents the two units side by side rather than combined.
export const STATS_NORMALIZATIONS = ["off", "normalized"] as const;
export type StatsNormalization = (typeof STATS_NORMALIZATIONS)[number];

export const STATS_TYPES = ["all", "cash_game", "tournament"] as const;
export type StatsType = (typeof STATS_TYPES)[number];

// ── URL search-param schema (route `validateSearch`) ─────────────────────────

export const statsSearchSchema = z.object({
	// Preset / custom date window — shared with the sessions filter.
	period: z.enum(PERIODS).default("all"),
	// Custom-range bounds, Unix seconds. Coerced because raw URL values arrive
	// as strings on a cold load / shared link.
	from: z.coerce.number().int().optional(),
	to: z.coerce.number().int().optional(),
	currency: z.string().optional(),
	// Default to normalized (BB / BI) so the page shows data without first
	// requiring a single-currency selection.
	norm: z.enum(STATS_NORMALIZATIONS).default("normalized"),
	type: z.enum(STATS_TYPES).default("all"),
	room: z.string().optional(),
});

export type StatsFilters = z.infer<typeof statsSearchSchema>;

/** Pure `validateSearch` implementation — exported for direct unit testing. */
export function parseStatsSearch(
	search: Record<string, unknown>
): StatsFilters {
	return statsSearchSchema.parse(search);
}

/** The filter state a bare `/statistics` resolves to. */
const DEFAULT_STATS_FILTERS = statsSearchSchema.parse({});

/**
 * True when no filter differs from its schema default — the "the user has not
 * stated a filter" test used to decide whether a default preset may take over.
 *
 * It deliberately does NOT look at the router's search object. `/statistics`
 * declares `validateSearch: statsSearchSchema`, and TanStack Router writes that
 * schema's defaults into `location.search` **and** into the URL itself, so a
 * bare `/statistics` is indistinguishable from an explicit link there — the
 * search object always carries `period` / `norm` / `type`. Comparing against
 * the defaults instead means a genuine deep link (`?type=tournament`) is
 * respected, while a bare load — or a link that merely spells the defaults out —
 * is treated as pristine. Pinned against the real router by
 * `apps/web/src/__tests__/statistics-raw-search.test.tsx`.
 *
 * An empty-string `currency` / `room` (reachable as `?room=`) counts as absent,
 * matching how `filtersToStatsInput` already coerces it.
 */
export function isDefaultStatsFilterState(filters: StatsFilters): boolean {
	const keys = new Set([
		...Object.keys(DEFAULT_STATS_FILTERS),
		...Object.keys(filters),
	]) as Set<keyof StatsFilters>;
	for (const key of keys) {
		const actual = filters[key] === "" ? undefined : filters[key];
		if (actual !== DEFAULT_STATS_FILTERS[key]) {
			return false;
		}
	}
	return true;
}

// ── Derived query input ──────────────────────────────────────────────────────

export interface StatsQueryInput {
	currencyId?: string;
	dateFrom?: number;
	dateTo?: number;
	normalized: boolean;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

/** Map UI filter state to the tRPC `stats.*` query input. */
export function filtersToStatsInput(
	filters: StatsFilters,
	nowSec?: number
): StatsQueryInput {
	const range = resolveDateRange(filters, nowSec);
	return {
		currencyId: filters.currency || undefined,
		type: filters.type === "all" ? undefined : filters.type,
		roomId: filters.room || undefined,
		dateFrom: range.dateFrom,
		dateTo: range.dateTo,
		normalized: filters.norm !== "off",
	};
}

/**
 * The currency scope is valid when either normalization is on (currency
 * optional) or a currency is selected. Mirrors the server's BAD_REQUEST guard.
 */
export function isCurrencyScopeValid(
	filters: Pick<StatsFilters, "currency" | "norm">
): boolean {
	return filters.norm !== "off" || Boolean(filters.currency);
}

/**
 * The normalized unit for a given game type: cash → "bb", tournament → "bi".
 * Used only when normalization is on.
 */
export function normalizedUnitForType(
	type: "cash_game" | "tournament"
): "bb" | "bi" {
	return type === "cash_game" ? "bb" : "bi";
}

/**
 * The unit suffix for a value that aggregates a single game type, given the
 * filter state: the currency unit when normalization is off, otherwise the
 * type's normalized unit (bb / bi).
 */
export function statsUnitFor(
	norm: StatsNormalization,
	type: "cash_game" | "tournament",
	currencyUnit: string | null | undefined
): string | null {
	return norm === "off" ? (currencyUnit ?? null) : normalizedUnitForType(type);
}
