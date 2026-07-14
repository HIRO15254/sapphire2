import { StatTable } from "@/features/statistics/pages/statistics-page/stat-table";
import { StatsQueryError } from "@/features/statistics/pages/statistics-page/stats-query-error";
import { useTournamentStats } from "@/features/statistics/pages/statistics-page/tournament-stats/use-tournament-stats";
import type { StatsSectionContext } from "@/features/statistics/types";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function TournamentStats({ ctx }: { ctx: StatsSectionContext }) {
	const { isEmpty, isError, isPending, retry, rows } = useTournamentStats(ctx);

	if (isPending) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-5 w-28 rounded-md" />
				<Skeleton className="h-72 rounded-xl" />
			</div>
		);
	}
	if (isError) {
		return <StatsQueryError onRetry={retry} />;
	}

	if (isEmpty) {
		return null;
	}

	return (
		<section className="space-y-3">
			<h2 className="t-h4">Tournaments</h2>
			<StatTable rows={rows} />
		</section>
	);
}
