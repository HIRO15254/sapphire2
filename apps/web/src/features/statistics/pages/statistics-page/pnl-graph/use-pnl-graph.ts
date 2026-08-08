import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { StatsSectionContext } from "@/features/statistics/types";
import {
	type AggregatedPoint,
	aggregatePnlPoints,
	type PnlGraphSessionType,
	type PnlGraphUnit,
	type PnlGraphXAxis,
} from "@/features/statistics/utils/aggregate-pnl-points";
import { trpc } from "@/utils/trpc";

export interface UsePnlGraphResult {
	dual: boolean;
	evToggleAvailable: boolean;
	isEmpty: boolean;
	isError: boolean;
	isPending: boolean;
	points: AggregatedPoint[];
	retry: () => void;
	setShowEvCash: (value: boolean) => void;
	setXAxis: (value: PnlGraphXAxis) => void;
	showEvCash: boolean;
	unit: PnlGraphUnit;
	xAxis: PnlGraphXAxis;
}

/**
 * Drives the cumulative P&L line graph. Owns the x-axis and EV-cash toggle
 * state, runs the `stats.profitLossSeries` query, and folds the raw series into
 * chart-ready cumulative points via the pure `aggregatePnlPoints` aggregator.
 * The unit follows the global normalization filter and the dual-axis mode only
 * applies to the normalized "all" scope (bb cash vs. bi tournament). The EV line
 * is cash-only AND needs at least one session with a recorded EV cash-out, so
 * the toggle is gated on both and its effective value forced off otherwise.
 * A persisted cache entry written before `evRecorded` existed rehydrates without
 * it, which reads as "no recorded EV" and hides the toggle until the query
 * refetches — the safe direction, so no cache buster is needed.
 */
export function usePnlGraph(ctx: StatsSectionContext): UsePnlGraphResult {
	const [xAxis, setXAxisState] = useState<PnlGraphXAxis>("playTime");
	const [showEvCash, setShowEvCash] = useState(false);

	const unit: PnlGraphUnit = ctx.normalized ? "normalized" : "currency";
	const sessionType: PnlGraphSessionType = ctx.type;

	const query = useQuery(
		trpc.stats.profitLossSeries.queryOptions(ctx.statsInput, {
			enabled: ctx.enabled,
		})
	);
	const series = query.data?.points;
	const rawPoints = series ?? [];

	// The EV line is cash-only, and it only says something the P/L line does not
	// when at least one session actually recorded an EV cash-out: a point with
	// no recorded EV falls back to its actual result, so a series made entirely
	// of those draws an EV line directly on top of the P/L line. Hiding the
	// toggle is the graph's version of the `—` the KPI cards show for the same
	// user.
	//
	// Only a loaded series can answer that, and changing a filter swaps the
	// query key so `data` goes back to undefined mid-answer. Neither default
	// works on its own: treating "not loaded" as unavailable unmounts the Switch
	// on every period / room / currency change (the toolbar around it stays
	// put), and treating it as available pops a Switch into that toolbar on
	// every load for exactly the user this gate exists to spare. So carry the
	// last resolved verdict across the gap — it starts hidden, and only a loaded
	// series ever moves it. The write is idempotent, so a double render under
	// StrictMode reaches the same value.
	const evRecordedSeen = useRef(false);
	if (series !== undefined) {
		evRecordedSeen.current = series.some((point) => point.evRecorded);
	}
	const evToggleAvailable = ctx.type === "cash_game" && evRecordedSeen.current;
	const effectiveShowEvCash = evToggleAvailable && showEvCash;

	const { points } = aggregatePnlPoints({
		rawPoints,
		xAxis,
		unit,
		sessionType,
		showEvCash: effectiveShowEvCash,
	});

	const dual = unit === "normalized" && sessionType === "all";

	return {
		xAxis,
		setXAxis: (value) => {
			if (value) {
				setXAxisState(value);
			}
		},
		showEvCash: effectiveShowEvCash,
		setShowEvCash,
		evToggleAvailable,
		points,
		dual,
		unit,
		isPending: ctx.enabled && query.isPending,
		isError: query.isError,
		retry: () => {
			query.refetch();
		},
		isEmpty: points.length === 0,
	};
}
