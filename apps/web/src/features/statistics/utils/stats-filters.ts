import z from "zod";

// ── Filter value domains ─────────────────────────────────────────────────────

export const STATS_PERIODS = [
	"7d",
	"30d",
	"90d",
	"ytd",
	"all",
	"custom",
] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

// Normalization is a single mode. "off" shows currency amounts (a currency
// must be selected); "normalized" shows big-blind (cash) and buy-in
// (tournament) normalized values SIMULTANEOUSLY. BB and BI live on different
// scales and must never be summed together, so any view that mixes cash and
// tournament sessions presents the two units side by side rather than combined.
export const STATS_NORMALIZATIONS = ["off", "normalized"] as const;
export type StatsNormalization = (typeof STATS_NORMALIZATIONS)[number];

export const STATS_TYPES = ["all", "cash_game", "tournament"] as const;
export type StatsType = (typeof STATS_TYPES)[number];

const DAY_SECONDS = 86_400;

// ── URL search-param schema (route `validateSearch`) ─────────────────────────

export const statsSearchSchema = z.object({
	period: z.enum(STATS_PERIODS).default("all"),
	// Custom-range bounds, Unix seconds. Coerced because raw URL values arrive
	// as strings on a cold load / shared link.
	from: z.coerce.number().int().optional(),
	to: z.coerce.number().int().optional(),
	currency: z.string().optional(),
	norm: z.enum(STATS_NORMALIZATIONS).default("off"),
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

// ── Derived query input ──────────────────────────────────────────────────────

export interface StatsQueryInput {
	currencyId?: string;
	dateFrom?: number;
	dateTo?: number;
	normalized: boolean;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

function startOfUtcDaySec(nowSec: number): number {
	const d = new Date(nowSec * 1000);
	return Math.floor(
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000
	);
}

function startOfUtcYearSec(nowSec: number): number {
	const d = new Date(nowSec * 1000);
	return Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
}

/**
 * Translate the selected period into a concrete `{ dateFrom?, dateTo? }` window
 * in Unix seconds. Relative windows snap their lower bound to the start of the
 * UTC day so the value (and therefore the query key) only changes once a day,
 * not on every render.
 */
export function resolveDateRange(
	filters: Pick<StatsFilters, "from" | "period" | "to">,
	nowSec: number = Math.floor(Date.now() / 1000)
): { dateFrom?: number; dateTo?: number } {
	const dayStart = startOfUtcDaySec(nowSec);
	switch (filters.period) {
		case "7d":
			return { dateFrom: dayStart - 7 * DAY_SECONDS };
		case "30d":
			return { dateFrom: dayStart - 30 * DAY_SECONDS };
		case "90d":
			return { dateFrom: dayStart - 90 * DAY_SECONDS };
		case "ytd":
			return { dateFrom: startOfUtcYearSec(nowSec) };
		case "custom": {
			const range: { dateFrom?: number; dateTo?: number } = {};
			if (filters.from !== undefined) {
				range.dateFrom = filters.from;
			}
			if (filters.to !== undefined) {
				range.dateTo = filters.to;
			}
			return range;
		}
		default:
			return {};
	}
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

// ── Custom-range date <input type="date"> conversion ─────────────────────────

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convert a `yyyy-mm-dd` value from a date input into Unix seconds (UTC).
 * `endOfDay` snaps to 23:59:59 so an upper bound is inclusive of the whole day.
 * Returns undefined for an empty / malformed value so the bound is cleared.
 */
export function dateInputToEpochSec(
	value: string,
	endOfDay = false
): number | undefined {
	if (!DATE_INPUT_RE.test(value)) {
		return undefined;
	}
	const [y, m, d] = value.split("-").map(Number);
	const ms = endOfDay
		? Date.UTC(y, m - 1, d, 23, 59, 59)
		: Date.UTC(y, m - 1, d, 0, 0, 0);
	return Math.floor(ms / 1000);
}

/** Convert Unix seconds back to a `yyyy-mm-dd` value for a date input (UTC). */
export function epochSecToDateInput(sec: number | undefined): string {
	if (sec === undefined) {
		return "";
	}
	return new Date(sec * 1000).toISOString().slice(0, 10);
}
