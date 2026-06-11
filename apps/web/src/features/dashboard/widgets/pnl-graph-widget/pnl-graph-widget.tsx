import type { WidgetRenderProps } from "@/features/dashboard/widgets/registry";
import { ChartBody } from "./chart-body";
import { InlineFilters } from "./inline-filters";
import { usePnlGraphWidget } from "./use-pnl-graph-widget";

export function PnlGraphWidget({ config }: WidgetRenderProps) {
	const widget = usePnlGraphWidget(config);
	const { isLoading, parsed, points, skippedCount, state } = widget;
	const flags = parsed.showFilters;
	const anyFilter =
		flags.xAxis ||
		flags.dateRange ||
		flags.sessionType ||
		flags.unit ||
		flags.room ||
		flags.currency;
	const dualSeries = state.unit === "normalized" && state.sessionType === "all";

	return (
		<div className="flex h-full flex-col gap-2 p-2">
			{anyFilter ? <InlineFilters {...widget} flags={flags} /> : null}

			<div className="min-h-0 flex-1">
				<ChartBody
					dual={dualSeries}
					isLoading={isLoading}
					points={points}
					showEvCash={state.showEvCash}
					xAxisType={state.xAxis}
				/>
			</div>

			{skippedCount > 0 ? (
				<div className="text-muted-foreground text-xs">
					{skippedCount} session{skippedCount === 1 ? "" : "s"} skipped (no unit
					info)
				</div>
			) : null}
		</div>
	);
}
