import { lazy, Suspense } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { PnlGraphXAxis } from "../use-pnl-graph-widget";

const PnlGraphChart = lazy(() => import("../pnl-graph-chart"));

interface AggregatedPoint {
	cashCumulative?: number;
	cumulative?: number;
	evCashCumulative?: number;
	tournamentCumulative?: number;
	x: number;
}

interface ChartBodyProps {
	dual: boolean;
	isLoading: boolean;
	points: AggregatedPoint[];
	showEvCash: boolean;
	xAxisType: PnlGraphXAxis;
}

export function ChartBody({
	dual,
	isLoading,
	points,
	showEvCash,
	xAxisType,
}: ChartBodyProps) {
	if (isLoading) {
		return <Skeleton className="h-full w-full" />;
	}
	if (points.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
				No data
			</div>
		);
	}
	return (
		<Suspense fallback={<Skeleton className="h-full w-full" />}>
			<PnlGraphChart
				dual={dual}
				points={points}
				showEvCash={showEvCash}
				xAxisType={xAxisType}
			/>
		</Suspense>
	);
}
