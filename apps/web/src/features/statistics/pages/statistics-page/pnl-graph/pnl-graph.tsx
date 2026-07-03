import { usePnlGraph } from "@/features/statistics/pages/statistics-page/pnl-graph/use-pnl-graph";
import type { StatsSectionContext } from "@/features/statistics/types";
import type { PnlGraphXAxis } from "@/features/statistics/utils/aggregate-pnl-points";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
import { ChartBody } from "./chart-body";
import { X_AXIS_LABEL, X_AXIS_VALUES } from "./labels";

const EV_TOGGLE_ID = "pnl-graph-ev-toggle";

export function PnlGraph({ ctx }: { ctx: StatsSectionContext }) {
	const {
		xAxis,
		setXAxis,
		showEvCash,
		setShowEvCash,
		evToggleAvailable,
		points,
		skippedCount,
		dual,
		isPending,
	} = usePnlGraph(ctx);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<ToggleGroup
					onValueChange={(value) => setXAxis(value as PnlGraphXAxis)}
					type="single"
					value={xAxis}
				>
					{X_AXIS_VALUES.map((value) => (
						<ToggleGroupItem
							className="data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
							key={value}
							size="sm"
							value={value}
						>
							{X_AXIS_LABEL[value]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				{evToggleAvailable ? (
					<div className="flex items-center gap-2">
						<Switch
							checked={showEvCash}
							id={EV_TOGGLE_ID}
							onCheckedChange={setShowEvCash}
						/>
						<Label
							className="text-muted-foreground text-sm"
							htmlFor={EV_TOGGLE_ID}
						>
							EV line
						</Label>
					</div>
				) : null}
			</div>
			<div className="h-64">
				<ChartBody
					dual={dual}
					isLoading={isPending}
					points={points}
					showEvCash={showEvCash}
					xAxisType={xAxis}
				/>
			</div>
			{skippedCount > 0 && (
				<p className="t-meta text-muted-foreground">
					{skippedCount} session{skippedCount === 1 ? "" : "s"} not shown (no
					stakes / buy-in recorded)
				</p>
			)}
		</div>
	);
}
