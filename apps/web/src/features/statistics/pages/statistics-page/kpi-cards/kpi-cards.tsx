import {
	type KpiCard,
	useKpiCards,
} from "@/features/statistics/pages/statistics-page/kpi-cards/use-kpi-cards";
import type { StatsSectionContext } from "@/features/statistics/types";
import { cn } from "@/lib/utils";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

function KpiCardItem({ card }: { card: KpiCard }) {
	return (
		<Card className="gap-1 px-3 py-2.5" size="sm">
			<span className="t-meta text-muted-foreground uppercase tracking-wide">
				{card.label}
			</span>
			<span
				className={cn(
					"font-mono font-semibold text-lg tabular-nums",
					card.trend === "up" && "text-success",
					card.trend === "down" && "text-destructive"
				)}
			>
				{card.value}
			</span>
			{card.hint && (
				<span className="t-meta text-muted-foreground">{card.hint}</span>
			)}
		</Card>
	);
}

export function KpiCards({ ctx }: { ctx: StatsSectionContext }) {
	const { cards, isPending } = useKpiCards(ctx);

	if (isPending) {
		return (
			<div className="grid grid-cols-3 gap-2">
				{["a", "b", "c"].map((k) => (
					<Skeleton className="h-[60px] rounded-xl" key={k} />
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-3 gap-2">
			{cards.map((card) => (
				<KpiCardItem card={card} key={card.key} />
			))}
		</div>
	);
}
