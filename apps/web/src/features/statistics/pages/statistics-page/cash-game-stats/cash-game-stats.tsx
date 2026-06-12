import { useCashGameStats } from "@/features/statistics/pages/statistics-page/cash-game-stats/use-cash-game-stats";
import { StatTable } from "@/features/statistics/pages/statistics-page/stat-table";
import type { StatsSectionContext } from "@/features/statistics/types";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function CashGameStats({ ctx }: { ctx: StatsSectionContext }) {
	const { isEmpty, isPending, rows } = useCashGameStats(ctx);

	if (isPending) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-5 w-28 rounded-md" />
				<Skeleton className="h-64 rounded-xl" />
			</div>
		);
	}

	if (isEmpty) {
		return null;
	}

	return (
		<section className="space-y-3">
			<h2 className="t-h4">Cash games</h2>
			<StatTable rows={rows} />
		</section>
	);
}
