import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import {
	type AggregatedPoint,
	aggregatePnlPoints,
	type PnlGraphUnit,
	type PnlGraphXAxis,
	type PnlSeriesPoint,
} from "./aggregate-pnl-points";

export type { PnlGraphUnit, PnlGraphXAxis } from "./aggregate-pnl-points";

export type PnlGraphSessionType = "all" | "cash_game" | "tournament";

export interface PnlGraphFilterFlags {
	currency: boolean;
	dateRange: boolean;
	ringGame: boolean;
	sessionType: boolean;
	store: boolean;
	unit: boolean;
	xAxis: boolean;
}

export interface PnlGraphParsedConfig {
	currencyId: string | null;
	dateRangeDays: number | null;
	ringGameId: string | null;
	sessionType: PnlGraphSessionType;
	showFilters: PnlGraphFilterFlags;
	storeId: string | null;
	unit: PnlGraphUnit;
	xAxis: PnlGraphXAxis;
}

export const PNL_GRAPH_X_AXIS_VALUES: PnlGraphXAxis[] = [
	"date",
	"sessionCount",
	"playTime",
];
export const PNL_GRAPH_UNIT_VALUES: PnlGraphUnit[] = ["currency", "bb", "bi"];
export const PNL_GRAPH_SESSION_TYPE_VALUES: PnlGraphSessionType[] = [
	"all",
	"cash_game",
	"tournament",
];

const DEFAULT_FLAGS: PnlGraphFilterFlags = {
	xAxis: false,
	dateRange: false,
	sessionType: false,
	unit: false,
	store: false,
	ringGame: false,
	currency: false,
};

function parseStringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function parseEnum<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T
): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseFlags(value: unknown): PnlGraphFilterFlags {
	if (!value || typeof value !== "object") {
		return DEFAULT_FLAGS;
	}
	const raw = value as Record<string, unknown>;
	return {
		xAxis: raw.xAxis === true,
		dateRange: raw.dateRange === true,
		sessionType: raw.sessionType === true,
		unit: raw.unit === true,
		store: raw.store === true,
		ringGame: raw.ringGame === true,
		currency: raw.currency === true,
	};
}

export function parsePnlGraphWidgetConfig(
	raw: Record<string, unknown>
): PnlGraphParsedConfig {
	return {
		xAxis: parseEnum(raw.xAxis, PNL_GRAPH_X_AXIS_VALUES, "date"),
		dateRangeDays:
			typeof raw.dateRangeDays === "number" && raw.dateRangeDays > 0
				? raw.dateRangeDays
				: null,
		sessionType: parseEnum(
			raw.sessionType,
			PNL_GRAPH_SESSION_TYPE_VALUES,
			"all"
		),
		unit: parseEnum(raw.unit, PNL_GRAPH_UNIT_VALUES, "currency"),
		storeId: parseStringOrNull(raw.storeId),
		ringGameId: parseStringOrNull(raw.ringGameId),
		currencyId: parseStringOrNull(raw.currencyId),
		showFilters: parseFlags(raw.showFilters),
	};
}

export interface PnlGraphRuntimeState {
	currencyId: string | null;
	dateRangeDays: number | null;
	ringGameId: string | null;
	sessionType: PnlGraphSessionType;
	storeId: string | null;
	unit: PnlGraphUnit;
	xAxis: PnlGraphXAxis;
}

function configToState(parsed: PnlGraphParsedConfig): PnlGraphRuntimeState {
	return {
		xAxis: parsed.xAxis,
		dateRangeDays: parsed.dateRangeDays,
		sessionType: parsed.sessionType,
		unit: parsed.unit,
		storeId: parsed.storeId,
		ringGameId: parsed.ringGameId,
		currencyId: parsed.currencyId,
	};
}

export function effectiveTypeFilter(
	state: PnlGraphRuntimeState
): "cash_game" | "tournament" | undefined {
	if (state.unit === "bb") {
		return "cash_game";
	}
	if (state.unit === "bi") {
		return "tournament";
	}
	return state.sessionType === "all" ? undefined : state.sessionType;
}

interface UsePnlGraphWidgetResult {
	error: unknown;
	isLoading: boolean;
	onChangeCurrencyId: (value: string | null) => void;
	onChangeDateRangeDays: (value: number | null) => void;
	onChangeRingGameId: (value: string | null) => void;
	onChangeSessionType: (value: PnlGraphSessionType) => void;
	onChangeStoreId: (value: string | null) => void;
	onChangeUnit: (value: PnlGraphUnit) => void;
	onChangeXAxis: (value: PnlGraphXAxis) => void;
	parsed: PnlGraphParsedConfig;
	points: AggregatedPoint[];
	rawPoints: PnlSeriesPoint[];
	skippedCount: number;
	state: PnlGraphRuntimeState;
}

export function usePnlGraphWidget(
	config: Record<string, unknown>
): UsePnlGraphWidgetResult {
	const parsed = parsePnlGraphWidgetConfig(config);
	const [state, setState] = useState<PnlGraphRuntimeState>(() =>
		configToState(parsed)
	);

	const dateFrom =
		state.dateRangeDays === null
			? undefined
			: Math.floor(Date.now() / 1000) - state.dateRangeDays * 86_400;

	const query = useQuery(
		trpc.session.profitLossSeries.queryOptions({
			type: effectiveTypeFilter(state),
			storeId: state.storeId ?? undefined,
			ringGameId: state.ringGameId ?? undefined,
			currencyId: state.currencyId ?? undefined,
			dateFrom,
		})
	);

	const rawPoints = (query.data?.points ?? []) as PnlSeriesPoint[];
	const aggregated = aggregatePnlPoints(rawPoints, state.xAxis, state.unit);

	return {
		error: query.error,
		isLoading: query.isLoading,
		onChangeCurrencyId: (value) =>
			setState((s) => ({ ...s, currencyId: value })),
		onChangeDateRangeDays: (value) =>
			setState((s) => ({ ...s, dateRangeDays: value })),
		onChangeRingGameId: (value) =>
			setState((s) => ({ ...s, ringGameId: value })),
		onChangeSessionType: (value) =>
			setState((s) => ({ ...s, sessionType: value })),
		onChangeStoreId: (value) => setState((s) => ({ ...s, storeId: value })),
		onChangeUnit: (value) => setState((s) => ({ ...s, unit: value })),
		onChangeXAxis: (value) => setState((s) => ({ ...s, xAxis: value })),
		parsed,
		points: aggregated.points,
		rawPoints,
		skippedCount: aggregated.skippedCount,
		state,
	};
}
