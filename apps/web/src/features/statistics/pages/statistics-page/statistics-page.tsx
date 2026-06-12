import { cn } from "@/lib/utils";
import { PageHeader } from "@/shared/components/page-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import type { StatisticsSummary } from "./use-statistics-page";
import { useStatisticsPage } from "./use-statistics-page";

function formatMetric(
	key: keyof StatisticsSummary,
	summary: StatisticsSummary
): string {
	switch (key) {
		case "totalSessions":
			return summary.totalSessions.toString();
		case "totalProfitLoss":
			return formatProfitLoss(summary.totalProfitLoss);
		case "winRate":
			return `${summary.winRate.toFixed(1)}%`;
		case "avgProfitLoss":
			return summary.avgProfitLoss === null
				? "—"
				: formatProfitLoss(Math.round(summary.avgProfitLoss));
		case "totalEvProfitLoss":
			return formatProfitLoss(summary.totalEvProfitLoss);
		case "totalEvDiff":
			return formatProfitLoss(summary.totalEvDiff);
		case "itmRate":
			return summary.itmRate === null ? "—" : `${summary.itmRate.toFixed(1)}%`;
		case "avgPlacement":
			return summary.avgPlacement === null
				? "—"
				: summary.avgPlacement.toFixed(1);
		default:
			return "—";
	}
}

function colorClass(
	key: keyof StatisticsSummary,
	summary: StatisticsSummary
): string {
	switch (key) {
		case "totalProfitLoss":
			return profitLossColorClass(summary.totalProfitLoss);
		case "avgProfitLoss":
			return profitLossColorClass(summary.avgProfitLoss);
		case "totalEvProfitLoss":
			return profitLossColorClass(summary.totalEvProfitLoss);
		case "totalEvDiff":
			return profitLossColorClass(summary.totalEvDiff);
		default:
			return "";
	}
}

interface MetricDef {
	key: keyof StatisticsSummary;
	label: string;
}

const BASE_METRICS: MetricDef[] = [
	{ key: "totalSessions", label: "Sessions" },
	{ key: "totalProfitLoss", label: "Total P&L" },
	{ key: "winRate", label: "Win Rate" },
	{ key: "avgProfitLoss", label: "Avg P&L" },
	{ key: "totalEvProfitLoss", label: "EV P&L" },
	{ key: "totalEvDiff", label: "EV Diff" },
];

const TOURNAMENT_METRICS: MetricDef[] = [
	{ key: "totalSessions", label: "Sessions" },
	{ key: "totalProfitLoss", label: "Total P&L" },
	{ key: "itmRate", label: "ITM Rate" },
	{ key: "avgPlacement", label: "Avg Placement" },
	{ key: "avgProfitLoss", label: "Avg P&L" },
	{ key: "totalEvProfitLoss", label: "EV P&L" },
];

function MetricsGrid({
	metrics,
	summary,
}: {
	metrics: MetricDef[];
	summary: StatisticsSummary;
}) {
	return (
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{metrics.map(({ key, label }) => (
				<div
					className="flex flex-col gap-0.5 rounded-md border px-3 py-2"
					key={key}
				>
					<span className="text-muted-foreground text-xs">{label}</span>
					<span
						className={cn("font-semibold text-sm", colorClass(key, summary))}
					>
						{formatMetric(key, summary)}
					</span>
				</div>
			))}
		</div>
	);
}

function SkeletonGrid() {
	return (
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton count
				<Skeleton className="h-14" key={i} />
			))}
		</div>
	);
}

function TabContent({
	isLoading,
	metrics,
	summary,
}: {
	isLoading: boolean;
	metrics: MetricDef[];
	summary: StatisticsSummary | undefined;
}) {
	if (isLoading) {
		return <SkeletonGrid />;
	}
	if (!summary || summary.totalSessions === 0) {
		return (
			<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
				No sessions yet
			</div>
		);
	}
	return <MetricsGrid metrics={metrics} summary={summary} />;
}

export function StatisticsPage() {
	const { isLoading, sessionType, setSessionType, summary } =
		useStatisticsPage();

	const metrics =
		sessionType === "tournament" ? TOURNAMENT_METRICS : BASE_METRICS;

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader heading="Statistics" />

				<Tabs
					className="mt-4"
					onValueChange={(v) => setSessionType(v as typeof sessionType)}
					value={sessionType}
				>
					<TabsList className="mb-4 grid w-full grid-cols-3">
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="cash_game">Cash game</TabsTrigger>
						<TabsTrigger value="tournament">Tournament</TabsTrigger>
					</TabsList>

					<TabsContent value={sessionType}>
						<TabContent
							isLoading={isLoading}
							metrics={metrics}
							summary={summary}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
