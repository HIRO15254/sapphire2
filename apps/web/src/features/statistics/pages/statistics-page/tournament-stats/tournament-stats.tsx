import { Link } from "@tanstack/react-router";
import {
	type TournamentMetric,
	type TournamentSessionRow,
	useTournamentStats,
} from "@/features/statistics/pages/statistics-page/tournament-stats/use-tournament-stats";
import type { StatsSectionContext } from "@/features/statistics/types";
import { cn } from "@/lib/utils";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { profitLossColorClass } from "@/utils/format-profit-loss";

function MetricCard({ metric }: { metric: TournamentMetric }) {
	return (
		<Card className="gap-1 px-4 py-3" size="sm">
			<span className="t-meta text-muted-foreground uppercase tracking-wide">
				{metric.label}
			</span>
			<span
				className={cn(
					"font-mono font-semibold text-2xl tabular-nums",
					metric.isProfitLoss && profitLossColorClass(metric.amount)
				)}
			>
				{metric.value}
			</span>
		</Card>
	);
}

function SessionRow({
	label,
	row,
}: {
	label: string;
	row: TournamentSessionRow;
}) {
	return (
		<Link
			className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ sessionId: row.id }}
			to="/sessions/$sessionId"
		>
			<span className="flex flex-col">
				<span className="t-meta text-muted-foreground uppercase tracking-wide">
					{label}
				</span>
				<span className="t-body-sm text-muted-foreground">{row.dateText}</span>
			</span>
			<span
				className={cn(
					"font-mono font-semibold tabular-nums",
					profitLossColorClass(row.amount)
				)}
			>
				{row.value}
			</span>
		</Link>
	);
}

export function TournamentStats({ ctx }: { ctx: StatsSectionContext }) {
	const { isEmpty, isPending, view } = useTournamentStats(ctx);

	if (isPending) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-5 w-28 rounded-md" />
				<div className="grid grid-cols-2 gap-3">
					{["a", "b", "c", "d"].map((k) => (
						<Skeleton className="h-[72px] rounded-xl" key={k} />
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
			<h2 className="t-h4">Tournaments</h2>
			<div className="grid grid-cols-2 gap-3">
				{view.metrics.map((metric) => (
					<MetricCard key={metric.key} metric={metric} />
				))}
			</div>
			{(view.bestSession || view.worstSession) && (
				<div className="space-y-2">
					{view.bestSession && (
						<SessionRow label="Best session" row={view.bestSession} />
					)}
					{view.worstSession && (
						<SessionRow label="Worst session" row={view.worstSession} />
					)}
				</div>
			)}
		</section>
	);
}
