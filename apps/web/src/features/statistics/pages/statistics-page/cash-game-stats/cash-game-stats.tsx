import {
	type CashGameMetric,
	useCashGameStats,
} from "@/features/statistics/pages/statistics-page/cash-game-stats/use-cash-game-stats";
import type { StatsSectionContext } from "@/features/statistics/types";
import { cn } from "@/lib/utils";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { profitLossColorClass } from "@/utils/format-profit-loss";

function MetricCard({ metric }: { metric: CashGameMetric }) {
	return (
		<Card className="gap-1 px-3 py-2.5" size="sm">
			<span className="t-meta text-muted-foreground uppercase tracking-wide">
				{metric.label}
			</span>
			<span
				className={cn(
					"font-mono font-semibold text-lg tabular-nums",
					metric.isProfitLoss && profitLossColorClass(metric.amount)
				)}
			>
				{metric.value}
			</span>
		</Card>
	);
}

export function CashGameStats({ ctx }: { ctx: StatsSectionContext }) {
	const { isEmpty, isPending, view } = useCashGameStats(ctx);

	if (isPending) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-5 w-28 rounded-md" />
				<div className="grid grid-cols-3 gap-2">
					{["a", "b", "c"].map((k) => (
						<Skeleton className="h-[60px] rounded-xl" key={k} />
					))}
				</div>
			</div>
		);
	}

	if (isEmpty || !view) {
		return null;
	}

	return (
		<section className="space-y-3">
			<h2 className="t-h4">Cash games</h2>
			<div className="grid grid-cols-3 gap-2">
				{view.metrics.map((metric) => (
					<MetricCard key={metric.key} metric={metric} />
				))}
			</div>
		</section>
	);
}
