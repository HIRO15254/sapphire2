import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
	isPending: boolean;
	points: AggregatedPoint[];
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
 * is cash-only, so the toggle is gated and its effective value forced off
 * otherwise.
 */
export function usePnlGraph(ctx: StatsSectionContext): UsePnlGraphResult {
	const [xAxis, setXAxisState] = useState<PnlGraphXAxis>("date");
	const [showEvCash, setShowEvCash] = useState(false);

	const unit: PnlGraphUnit = ctx.normalized ? "normalized" : "currency";
	const sessionType: PnlGraphSessionType = ctx.type;
	const evToggleAvailable = ctx.type === "cash_game";
	const effectiveShowEvCash = evToggleAvailable && showEvCash;

	const query = useQuery(
		trpc.stats.profitLossSeries.queryOptions(ctx.statsInput, {
			enabled: ctx.enabled,
		})
	);
	const rawPoints = query.data?.points ?? [];

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
		isEmpty: points.length === 0,
	};
}
