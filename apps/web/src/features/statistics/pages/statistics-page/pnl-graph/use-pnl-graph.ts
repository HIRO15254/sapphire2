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
