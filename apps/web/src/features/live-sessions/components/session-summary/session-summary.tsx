import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/shared/components/ui/card";
import { formatCompactNumber } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";

interface SessionSummaryProps {
	summary: {
		totalBuyIn: number;
		cashOut: number | null;
		profitLoss: number | null;
		evCashOut: number | null;
		addonCount: number;
		maxStack: number | null;
		minStack: number | null;
		currentStack: number | null;
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
		<Card size="sm">
			<CardContent className="flex flex-col gap-0.5">
				<span className="text-muted-foreground text-xs">{label}</span>
				<span className={cn("font-semibold text-sm", colorClass)}>{value}</span>
			</CardContent>
		</Card>
	);
}

export function SessionSummary({ summary }: SessionSummaryProps) {
	const hasStackRange = summary.minStack !== null && summary.maxStack !== null;

	return (
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
			<StatCard
				label="Total Buy-in"
				value={formatCompactNumber(summary.totalBuyIn)}
			/>

			<StatCard
				label="Cash Out"
				value={
					summary.cashOut === null ? "-" : formatCompactNumber(summary.cashOut)
				}
			/>

			<StatCard
				colorClass={
					summary.profitLoss === null
						? undefined
						: profitLossColorClass(summary.profitLoss)
				}
				label="P&L"
				value={
					summary.profitLoss === null
						? "-"
						: formatProfitLoss(summary.profitLoss)
				}
			/>

			{summary.evCashOut !== null && (
				<StatCard
					label="EV Cash Out"
					value={formatCompactNumber(summary.evCashOut)}
				/>
			)}

			{summary.currentStack !== null && (
				<StatCard
					label="Current Stack"
					value={formatCompactNumber(summary.currentStack)}
				/>
			)}

			{hasStackRange && (
				<StatCard
					label="Stack Range"
					value={`${formatCompactNumber(summary.minStack as number)} ~ ${formatCompactNumber(summary.maxStack as number)}`}
				/>
			)}

			<StatCard label="Addon Count" value={summary.addonCount.toString()} />
		</div>
	);
}
