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

function computeAlignedDomain(
	min: number,
	max: number,
	negFrac: number
): [number, number] {
	if (min === 0 && max === 0) {
		return [-1, 1];
	}
	if (negFrac === 0) {
		return [0, max || 1];
	}
	if (negFrac === 1) {
		return [min || -1, 0];
	}
	const candidateMin = (-max * negFrac) / (1 - negFrac);
	if (candidateMin <= min) {
		return [candidateMin, max];
	}
	const newMax = (-min * (1 - negFrac)) / negFrac;
	return [min, newMax];
}

interface ScanResult {
	bbMax: number;
	bbMin: number;
	biMax: number;
	biMin: number;
}

function scanDualValues(points: ChartPoint[]): ScanResult {
	let bbMin = 0;
	let bbMax = 0;
	let biMin = 0;
	let biMax = 0;
	for (const p of points) {
		if (typeof p.cashCumulative === "number") {
			bbMin = Math.min(bbMin, p.cashCumulative);
			bbMax = Math.max(bbMax, p.cashCumulative);
		}
		if (typeof p.evCashCumulative === "number") {
			bbMin = Math.min(bbMin, p.evCashCumulative);
			bbMax = Math.max(bbMax, p.evCashCumulative);
		}
		if (typeof p.tournamentCumulative === "number") {
			biMin = Math.min(biMin, p.tournamentCumulative);
			biMax = Math.max(biMax, p.tournamentCumulative);
		}
	}
	return { bbMin, bbMax, biMin, biMax };
}

function alignedDualDomains(points: ChartPoint[]): {
	bb: [number, number];
	bi: [number, number];
} {
	const { bbMin, bbMax, biMin, biMax } = scanDualValues(points);
	const bbRange = bbMax - bbMin || 1;
	const biRange = biMax - biMin || 1;
	const bbNegFrac = -bbMin / bbRange;
	const biNegFrac = -biMin / biRange;
	const negFrac = Math.max(bbNegFrac, biNegFrac);
	return {
		bb: computeAlignedDomain(bbMin, bbMax, negFrac),
		bi: computeAlignedDomain(biMin, biMax, negFrac),
	};
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
	const dualDomains = dual ? alignedDualDomains(points) : null;
	const singleColor = dual ? COLOR_CASH : COLOR_PRIMARY;
	return (
		<div className="h-full w-full">
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
					{dual && dualDomains ? (
						<>
							<YAxis
								domain={dualDomains.bb}
								tick={{ fontSize: 10 }}
								tickFormatter={(v: number) => formatCompactNumber(v)}
								width={50}
								yAxisId="bb"
							/>
							<YAxis
								domain={dualDomains.bi}
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
							{showEvCash ? (
								<Line
									connectNulls
									dataKey="evCashCumulative"
									dot={false}
									isAnimationActive={false}
									name="EV BB (cash)"
									stroke={COLOR_CASH}
									strokeDasharray="4 4"
									strokeWidth={2}
									type="linear"
									yAxisId="bb"
								/>
							) : null}
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
						</>
					) : (
						<>
							<Line
								dataKey="cumulative"
								dot={false}
								isAnimationActive={false}
								name="Cumulative"
								stroke={singleColor}
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
									stroke={singleColor}
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
