import { formatCompactNumber } from "@/utils/format-number";

interface SessionSummaryProps {
	summary: {
		avgPlacement: number | null;
		avgProfitLoss: number | null;
		itmRate: number | null;
		totalEvDiff: number | null;
		totalEvProfitLoss: number | null;
		totalPrizeMoney: number | null;
		totalProfitLoss: number;
		totalSessions: number;
		winRate: number;
	};
}

function StatCard({
	label,
	value,
	colorClass,
}: {
	colorClass?: string;
	label: string;
	value: string;
}) {
	return (
		<div className="flex flex-col gap-0.5 rounded-lg border px-3 py-2">
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className={`font-semibold text-sm ${colorClass ?? ""}`}>
				{value}
			</span>
		</div>
	);
}

function plColorClass(value: number): string {
	if (value > 0) return "text-green-600";
	if (value < 0) return "text-red-600";
	return "";
}

export function SessionSummary({ summary }: SessionSummaryProps) {
	if (summary.totalSessions === 0) {
		return null;
	}

	return (
		<div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
			<StatCard
				label="Total Sessions"
				value={summary.totalSessions.toString()}
			/>
			<StatCard
				colorClass={plColorClass(summary.totalProfitLoss)}
				label="Total P&L"
				value={`${summary.totalProfitLoss >= 0 ? "+" : ""}${formatCompactNumber(summary.totalProfitLoss)}`}
			/>
			<StatCard
				label="Win Rate"
				value={`${summary.winRate.toFixed(1)}%`}
			/>
			{summary.avgProfitLoss !== null && (
				<StatCard
					colorClass={plColorClass(summary.avgProfitLoss)}
					label="Avg P&L"
					value={`${summary.avgProfitLoss >= 0 ? "+" : ""}${formatCompactNumber(Math.round(summary.avgProfitLoss))}`}
				/>
			)}
			{summary.avgPlacement !== null && (
				<StatCard
					label="Avg Placement"
					value={summary.avgPlacement.toFixed(1)}
				/>
			)}
			{summary.totalPrizeMoney !== null && (
				<StatCard
					label="Total Prize"
					value={formatCompactNumber(summary.totalPrizeMoney)}
				/>
			)}
			{summary.itmRate !== null && (
				<StatCard label="ITM Rate" value={`${summary.itmRate.toFixed(1)}%`} />
			)}
			{summary.totalEvProfitLoss !== null && (
				<StatCard
					colorClass={plColorClass(summary.totalEvProfitLoss)}
					label="Total EV P&L"
					value={`${summary.totalEvProfitLoss >= 0 ? "+" : ""}${formatCompactNumber(summary.totalEvProfitLoss)}`}
				/>
			)}
			{summary.totalEvDiff !== null && (
				<StatCard
					colorClass={plColorClass(summary.totalEvDiff)}
					label="Total EV Diff"
					value={`${summary.totalEvDiff >= 0 ? "+" : ""}${formatCompactNumber(summary.totalEvDiff)}`}
				/>
			)}
		</div>
	);
}
