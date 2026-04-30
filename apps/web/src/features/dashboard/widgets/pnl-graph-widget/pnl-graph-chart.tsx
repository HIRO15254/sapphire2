import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCompactNumber } from "@/utils/format-number";
import type { PnlGraphXAxis } from "./aggregate-pnl-points";

const COLOR_CASH = "oklch(0.62 0.21 250)";
const COLOR_TOURNAMENT = "oklch(0.75 0.16 70)";
const COLOR_EV_CASH = "oklch(0.7 0.17 162)";
const COLOR_PRIMARY = "var(--color-primary)";

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
	evCashCumulative?: number;
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
	showEvCash: boolean;
	xAxisType: PnlGraphXAxis;
}

export default function PnlGraphChart({
	dual,
	points,
	showEvCash,
	xAxisType,
}: PnlGraphChartProps) {
	const showLegend = dual || showEvCash;
	return (
		<div className="h-full w-full focus:outline-none [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none [&_.recharts-wrapper]:focus:outline-none [&_.recharts-wrapper]:focus-visible:outline-none">
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
					{showLegend ? (
						<Legend
							iconSize={10}
							iconType="line"
							wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
						/>
					) : null}
					{dual ? (
						<>
							<Line
								connectNulls
								dataKey="cashCumulative"
								dot={false}
								isAnimationActive={false}
								name="BB (cash)"
								stroke={COLOR_CASH}
								strokeWidth={2}
								type="linear"
								yAxisId="bb"
							/>
							<Line
								connectNulls
								dataKey="tournamentCumulative"
								dot={false}
								isAnimationActive={false}
								name="BI (tournament)"
								stroke={COLOR_TOURNAMENT}
								strokeWidth={2}
								type="linear"
								yAxisId="bi"
							/>
							{showEvCash ? (
								<Line
									connectNulls
									dataKey="evCashCumulative"
									dot={false}
									isAnimationActive={false}
									name="EV BB (cash)"
									stroke={COLOR_EV_CASH}
									strokeDasharray="4 4"
									strokeWidth={2}
									type="linear"
									yAxisId="bb"
								/>
							) : null}
						</>
					) : (
						<>
							<Line
								dataKey="cumulative"
								dot={false}
								isAnimationActive={false}
								name="Cumulative"
								stroke={COLOR_PRIMARY}
								strokeWidth={2}
								type="linear"
							/>
							{showEvCash ? (
								<Line
									connectNulls
									dataKey="evCashCumulative"
									dot={false}
									isAnimationActive={false}
									name="EV (cash)"
									stroke={COLOR_EV_CASH}
									strokeDasharray="4 4"
									strokeWidth={2}
									type="linear"
								/>
							) : null}
						</>
					)}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
