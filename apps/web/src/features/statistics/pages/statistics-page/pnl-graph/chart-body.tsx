import { lazy, Suspense } from "react";
import type { PnlGraphXAxis } from "@/features/statistics/utils/aggregate-pnl-points";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { ChartPoint } from "./aligned-domains";

const PnlGraphChart = lazy(() => import("./pnl-graph-chart"));

interface ChartBodyProps {
	dual: boolean;
	isLoading: boolean;
	points: ChartPoint[];
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
