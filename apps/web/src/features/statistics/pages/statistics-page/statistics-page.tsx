import { IconChartHistogram } from "@tabler/icons-react";
import { StatsFilterBar } from "@/features/statistics/components/stats-filter-bar";
import { KpiCards } from "@/features/statistics/pages/statistics-page/kpi-cards";
import { useStatisticsPage } from "@/features/statistics/pages/statistics-page/use-statistics-page";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function StatisticsPage() {
	const { ctx, isScopeValid } = useStatisticsPage();

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="px-4 pt-4">
				<PageHeader heading="Statistics" />
			</div>
			<StatsFilterBar />
			<div className="space-y-6 p-4">
				{isScopeValid ? (
					<KpiCards ctx={ctx} />
				) : (
					<EmptyState
						description="Select a currency, or enable BB / BI normalization to combine results across currencies."
						heading="Choose a scope to see your stats"
						icon={<IconChartHistogram size={32} />}
					/>
				)}
			</div>
		</div>
	);
}
