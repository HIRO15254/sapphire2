import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import {
	type KpiCard,
	useKpiCards,
} from "@/features/statistics/pages/statistics-page/kpi-cards/use-kpi-cards";
import type { StatsSectionContext } from "@/features/statistics/types";
import { cn } from "@/lib/utils";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

function TrendIcon({ trend }: { trend: KpiCard["trend"] }) {
	if (trend === "up") {
		return <IconTrendingUp className="size-4 text-success" />;
	}
	if (trend === "down") {
		return <IconTrendingDown className="size-4 text-destructive" />;
	}
	return null;
}

function KpiCardItem({ card }: { card: KpiCard }) {
	return (
		<Card className="gap-1 px-4 py-3" size="sm">
			<span className="t-meta text-muted-foreground uppercase tracking-wide">
				{card.label}
			</span>
			<div className="flex items-center gap-1.5">
				<span
					className={cn(
						"font-mono font-semibold text-2xl tabular-nums",
						card.trend === "up" && "text-success",
						card.trend === "down" && "text-destructive"
					)}
				>
					{card.value}
				</span>
				<TrendIcon trend={card.trend} />
			</div>
		</Card>
	);
}

export function KpiCards({ ctx }: { ctx: StatsSectionContext }) {
	const { cards, isPending } = useKpiCards(ctx);

	if (isPending) {
		return (
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{["a", "b", "c", "d"].map((k) => (
					<Skeleton className="h-[72px] rounded-xl" key={k} />
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{cards.map((card) => (
				<KpiCardItem card={card} key={card.key} />
			))}
		</div>
	);
}
