import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCompactNumber } from "@/utils/format-number";
import type { PnlGraphXAxis } from "./aggregate-pnl-points";

function formatXTick(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		const d = new Date(value);
		const month = String(d.getUTCMonth() + 1).padStart(2, "0");
		const day = String(d.getUTCDate()).padStart(2, "0");
		return `${month}/${day}`;
	}
	if (xAxis === "playTime") {
		return value.toFixed(1);
	}
	return formatCompactNumber(value);
}

function formatTooltipLabel(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		return new Date(value).toISOString().slice(0, 10);
	}
	if (xAxis === "playTime") {
		return `${value.toFixed(1)} h`;
	}
	return `Session ${value}`;
}

interface ChartPoint {
	cashCumulative?: number;
	cumulative?: number;
	tournamentCumulative?: number;
	x: number;
}

interface TooltipPayloadItem {
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

function CustomTooltip({ active, label, payload, xAxis }: CustomTooltipProps) {
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

interface PnlGraphChartProps {
	dual: boolean;
	points: ChartPoint[];
	xAxisType: PnlGraphXAxis;
}

export default function PnlGraphChart({
	dual,
	points,
	xAxisType,
}: PnlGraphChartProps) {
	return (
		<ResponsiveContainer height="100%" width="100%">
			<LineChart
				data={points}
				margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
			>
				<CartesianGrid className="stroke-border" strokeDasharray="3 3" />
				<XAxis
					dataKey="x"
					domain={["dataMin", "dataMax"]}
					tick={{ fontSize: 10 }}
					tickFormatter={(v: number) => formatXTick(v, xAxisType)}
					type="number"
				/>
				{dual ? (
					<>
						<YAxis
							tick={{ fontSize: 10 }}
							tickFormatter={(v: number) => formatCompactNumber(v)}
							width={50}
							yAxisId="bb"
						/>
						<YAxis
							orientation="right"
							tick={{ fontSize: 10 }}
							tickFormatter={(v: number) => formatCompactNumber(v)}
							width={50}
							yAxisId="bi"
						/>
					</>
				) : (
					<YAxis
						tick={{ fontSize: 10 }}
						tickFormatter={(v: number) => formatCompactNumber(v)}
						width={50}
					/>
				)}
				<Tooltip
					content={(props) => (
						<CustomTooltip
							active={props.active}
							label={props.label as number | string | undefined}
							payload={
								props.payload as readonly TooltipPayloadItem[] | undefined
							}
							xAxis={xAxisType}
						/>
					)}
					cursor={false}
					wrapperStyle={{ outline: "none" }}
				/>
				{dual ? (
					<>
						<Line
							className="stroke-chart-1"
							connectNulls
							dataKey="cashCumulative"
							dot={false}
							isAnimationActive={false}
							name="BB (cash)"
							strokeWidth={2}
							type="linear"
							yAxisId="bb"
						/>
						<Line
							className="stroke-chart-2"
							connectNulls
							dataKey="tournamentCumulative"
							dot={false}
							isAnimationActive={false}
							name="BI (tournament)"
							strokeWidth={2}
							type="linear"
							yAxisId="bi"
						/>
					</>
				) : (
					<Line
						className="stroke-primary"
						dataKey="cumulative"
						dot={false}
						isAnimationActive={false}
						name="Cumulative"
						strokeWidth={2}
						type="linear"
					/>
				)}
			</LineChart>
		</ResponsiveContainer>
	);
}
