import { formatCompactNumber } from "@/utils/format-number";
import type { PnlGraphXAxis } from "../aggregate-pnl-points";

function formatTooltipLabel(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		return new Date(value).toISOString().slice(0, 10);
	}
	if (xAxis === "playTime") {
		return `${value.toFixed(1)} h`;
	}
	return `Session ${value}`;
}

export interface TooltipPayloadItem {
	color?: string;
	dataKey?: string | number;
	name?: string | number;
	value?: number | string | (number | string)[];
}

interface CustomTooltipProps {
	active?: boolean;
	label?: number | string;
	payload?: readonly TooltipPayloadItem[];
	xAxis: PnlGraphXAxis;
}

export function CustomTooltip({
	active,
	label,
	payload,
	xAxis,
}: CustomTooltipProps) {
	if (!(active && payload) || payload.length === 0) {
		return null;
	}
	return (
		<div className="rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-md">
			{typeof label === "number" ? (
				<div className="text-muted-foreground">
					{formatTooltipLabel(label, xAxis)}
				</div>
			) : null}
			{payload.map((item) => (
				<div
					className="flex items-center gap-2"
					key={String(item.dataKey ?? item.name)}
				>
					<span
						className="inline-block h-2 w-2 rounded-full"
						style={{ backgroundColor: item.color }}
					/>
					<span className="text-muted-foreground">
						{String(item.name ?? "")}
					</span>
					<span className="font-medium tabular-nums">
						{typeof item.value === "number"
							? formatCompactNumber(item.value)
							: ""}
					</span>
				</div>
			))}
		</div>
	);
}
