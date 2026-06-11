import { cn } from "@/lib/utils";
import type { CashGameCompactSummaryData } from "../cash-game-session/use-cash-game-session-view";
import { useCashGameCompactSummary } from "./use-cash-game-compact-summary";

export function CashGameCompactSummary({
	summary,
}: {
	summary: CashGameCompactSummaryData;
}) {
	const vm = useCashGameCompactSummary(summary);

	return (
		<div className="flex rounded-md border">
			<div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
				<span className="text-muted-foreground text-xs">Time</span>
				<p className="font-semibold">{vm.duration}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">Total Buy-in</span>
				<p className="font-semibold">{vm.totalBuyInFormatted}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">P&L</span>
				<p className={cn("font-semibold", vm.displayPLColorClass || undefined)}>
					{vm.displayPLFormatted}
				</p>
				{vm.showEvPL ? (
					<p className={cn("text-xs", vm.evPLColorClass)}>
						EV: {vm.evPLFormatted}
					</p>
				) : null}
			</div>
		</div>
	);
}
