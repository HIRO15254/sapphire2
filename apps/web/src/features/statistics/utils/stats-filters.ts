import z from "zod";
import { PERIODS, resolveDateRange } from "@/shared/lib/period-filter";

export const STATS_NORMALIZATIONS = ["off", "normalized"] as const;
export type StatsNormalization = (typeof STATS_NORMALIZATIONS)[number];

export const STATS_TYPES = ["all", "cash_game", "tournament"] as const;
export type StatsType = (typeof STATS_TYPES)[number];

export const statsSearchSchema = z.object({
	period: z.enum(PERIODS).default("all"),
	from: z.coerce.number().int().optional(),
	to: z.coerce.number().int().optional(),
	currency: z.string().optional(),
	norm: z.enum(STATS_NORMALIZATIONS).default("normalized"),
	type: z.enum(STATS_TYPES).default("all"),
	room: z.string().optional(),
});

export type StatsFilters = z.infer<typeof statsSearchSchema>;

export function parseStatsSearch(
	search: Record<string, unknown>
): StatsFilters {
	return statsSearchSchema.parse(search);
}

const DEFAULT_STATS_FILTERS = statsSearchSchema.parse({});

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

export interface StatsQueryInput {
	currencyId?: string;
	dateFrom?: number;
	dateTo?: number;
	normalized: boolean;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

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

export function isCurrencyScopeValid(
	filters: Pick<StatsFilters, "currency" | "norm">
): boolean {
	return filters.norm !== "off" || Boolean(filters.currency);
}

export function normalizedUnitForType(
	type: "cash_game" | "tournament"
): "bb" | "bi" {
	return type === "cash_game" ? "bb" : "bi";
}

export function statsUnitFor(
	norm: StatsNormalization,
	type: "cash_game" | "tournament",
	currencyUnit: string | null | undefined
): string | null {
	return norm === "off" ? (currencyUnit ?? null) : normalizedUnitForType(type);
}
