import type { ReactNode } from "react";
import { BreakdownTable } from "@/features/statistics/pages/statistics-page/breakdown-section/breakdown-table";
import { useBreakdownSection } from "@/features/statistics/pages/statistics-page/breakdown-section/use-breakdown-section";
import { StatsQueryError } from "@/features/statistics/pages/statistics-page/stats-query-error";
import type { StatsSectionContext } from "@/features/statistics/types";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

export function BreakdownSection({ ctx }: { ctx: StatsSectionContext }) {
	const {
		tabs,
		activeTab,
		setActiveTab,
		rows,
		isPending,
		isError,
		retry,
		normalized,
		showCashColumn,
		showNetColumn,
		showTournamentColumn,
	} = useBreakdownSection(ctx);

	let content: ReactNode;
	if (isPending) {
		content = <Skeleton className="h-48 rounded-xl" />;
	} else if (isError) {
		content = <StatsQueryError onRetry={retry} />;
	} else {
		content = (
			<BreakdownTable
				normalized={normalized}
				rows={rows}
				showCashColumn={showCashColumn}
				showNetColumn={showNetColumn}
				showTournamentColumn={showTournamentColumn}
			/>
		);
	}

	return (
		<div className="space-y-3">
			<Tabs
				onValueChange={(value) =>
					setActiveTab(value as (typeof tabs)[number]["value"])
				}
				value={activeTab}
			>
				<div className="overflow-x-auto">
					<TabsList variant="line">
						{tabs.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
			</Tabs>
			{content}
		</div>
	);
}
