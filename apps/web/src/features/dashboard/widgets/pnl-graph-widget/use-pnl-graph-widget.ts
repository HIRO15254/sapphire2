import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "@/utils/trpc";
import {
	type AggregatedPoint,
	aggregatePnlPoints,
	type PnlGraphSessionType,
	type PnlGraphUnit,
	type PnlGraphXAxis,
	type PnlSeriesPoint,
} from "./aggregate-pnl-points";

export type {
	PnlGraphSessionType,
	PnlGraphUnit,
	PnlGraphXAxis,
} from "./aggregate-pnl-points";

export interface PnlGraphFilterFlags {
	currency: boolean;
	dateRange: boolean;
	room: boolean;
	sessionType: boolean;
	unit: boolean;
	xAxis: boolean;
}

export interface PnlGraphParsedConfig {
	currencyId: string | null;
	dateRangeDays: number | null;
	ringGameId: string | null;
	roomId: string | null;
	sessionType: PnlGraphSessionType;
	showEvCash: boolean;
	showFilters: PnlGraphFilterFlags;
	unit: PnlGraphUnit;
	xAxis: PnlGraphXAxis;
}

export const PNL_GRAPH_X_AXIS_VALUES: PnlGraphXAxis[] = [
	"date",
	"sessionCount",
	"playTime",
];
export const PNL_GRAPH_UNIT_VALUES: PnlGraphUnit[] = ["currency", "normalized"];
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
	room: false,
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
		room: raw.room === true,
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
		roomId: parseStringOrNull(raw.roomId),
		ringGameId: parseStringOrNull(raw.ringGameId),
		currencyId: parseStringOrNull(raw.currencyId),
		showEvCash: raw.showEvCash === true,
		showFilters: parseFlags(raw.showFilters),
	};
}

export interface PnlGraphRuntimeState {
	currencyId: string | null;
	dateRangeDays: number | null;
	ringGameId: string | null;
	roomId: string | null;
	sessionType: PnlGraphSessionType;
	showEvCash: boolean;
	unit: PnlGraphUnit;
	xAxis: PnlGraphXAxis;
}

function configToState(parsed: PnlGraphParsedConfig): PnlGraphRuntimeState {
	return {
		xAxis: parsed.xAxis,
		dateRangeDays: parsed.dateRangeDays,
		sessionType: parsed.sessionType,
		unit: parsed.unit,
		roomId: parsed.roomId,
		ringGameId: parsed.ringGameId,
		currencyId: parsed.currencyId,
		showEvCash: parsed.showEvCash,
	};
}

export function effectiveTypeFilter(
	state: PnlGraphRuntimeState
): "cash_game" | "tournament" | undefined {
	return state.sessionType === "all" ? undefined : state.sessionType;
}

export interface PnlGraphSelectOption {
	id: string;
	name: string;
}

interface UsePnlGraphWidgetResult {
	currencies: PnlGraphSelectOption[];
	error: unknown;
	isLoading: boolean;
	onChangeCurrencyId: (value: string | null) => void;
	onChangeDateRangeDays: (value: number | null) => void;
	onChangeRingGameId: (value: string | null) => void;
	onChangeRoomId: (value: string | null) => void;
	onChangeSessionType: (value: PnlGraphSessionType) => void;
	onChangeUnit: (value: PnlGraphUnit) => void;
	onChangeXAxis: (value: PnlGraphXAxis) => void;
	parsed: PnlGraphParsedConfig;
	points: AggregatedPoint[];
	rawPoints: PnlSeriesPoint[];
	rooms: PnlGraphSelectOption[];
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
			roomId: state.roomId ?? undefined,
			ringGameId: state.ringGameId ?? undefined,
			currencyId: state.currencyId ?? undefined,
			dateFrom,
		})
	);

	const roomsQuery = useQuery(
		trpc.room.list.queryOptions(undefined, {
			enabled: parsed.showFilters.room,
		})
	);
	const currenciesQuery = useQuery(
		trpc.currency.list.queryOptions(undefined, {
			enabled: parsed.showFilters.currency,
		})
	);

	const rawPoints = (query.data?.points ?? []) as PnlSeriesPoint[];
	const aggregated = aggregatePnlPoints({
		rawPoints,
		xAxis: state.xAxis,
		unit: state.unit,
		sessionType: state.sessionType,
		showEvCash: state.showEvCash,
	});

	const rooms = (roomsQuery.data ?? []) as PnlGraphSelectOption[];
	const currencies = (currenciesQuery.data ?? []) as PnlGraphSelectOption[];

	return {
		currencies,
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
		onChangeRoomId: (value) => setState((s) => ({ ...s, roomId: value })),
		onChangeUnit: (value) => setState((s) => ({ ...s, unit: value })),
		onChangeXAxis: (value) => setState((s) => ({ ...s, xAxis: value })),
		parsed,
		points: aggregated.points,
		rawPoints,
		skippedCount: aggregated.skippedCount,
		state,
		rooms,
	};
}
