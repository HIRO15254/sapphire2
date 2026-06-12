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
import type { PnlGraphXAxis } from "@/features/statistics/utils/aggregate-pnl-points";
import { alignedDualDomains, type ChartPoint } from "./aligned-domains";
import { CustomLegend, type LegendItem } from "./custom-legend";
import { CustomTooltip, type TooltipPayloadItem } from "./custom-tooltip";

const COLOR_CASH = "var(--chart-1)";
const COLOR_TOURNAMENT = "var(--chart-5)";
const COLOR_PRIMARY = "var(--primary)";

// Both axes render values to 3 significant figures with k / M compaction.
const AXIS_NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumSignificantDigits: 3,
});

function formatAxisValue(value: number): string {
	return AXIS_NUMBER_FORMAT.format(value);
}

function formatXTick(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		const d = new Date(value);
		const month = String(d.getUTCMonth() + 1).padStart(2, "0");
		const day = String(d.getUTCDate()).padStart(2, "0");
		return `${month}/${day}`;
	}
	return formatAxisValue(value);
}

interface PnlGraphChartProps {
	dual: boolean;
	points: ChartPoint[];
	showEvCash: boolean;
	xAxisType: PnlGraphXAxis;
}

function legendItemsFor(
	dual: boolean,
	showEvCash: boolean,
	singleColor: string
): LegendItem[] {
	if (dual) {
		const items: LegendItem[] = [
			{ value: "BB (cash)", color: COLOR_CASH, dashed: false },
		];
		if (showEvCash) {
			items.push({ value: "EV BB (cash)", color: COLOR_CASH, dashed: true });
		}
		items.push({
			value: "BI (tournament)",
			color: COLOR_TOURNAMENT,
			dashed: false,
		});
		return items;
	}
	const items: LegendItem[] = [
		{ value: "Cumulative", color: singleColor, dashed: false },
	];
	if (showEvCash) {
		items.push({ value: "EV (cash)", color: singleColor, dashed: true });
	}
	return items;
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
	const legendItems = legendItemsFor(dual, showEvCash, singleColor);
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
								tickFormatter={(v: number) => formatAxisValue(v)}
								width={50}
								yAxisId="bb"
							/>
							<YAxis
								domain={dualDomains.bi}
								orientation="right"
								tick={{ fontSize: 10 }}
								tickFormatter={(v: number) => formatAxisValue(v)}
								width={50}
								yAxisId="bi"
							/>
						</>
					) : (
						<YAxis
							tick={{ fontSize: 10 }}
							tickFormatter={(v: number) => formatAxisValue(v)}
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
							content={() => <CustomLegend items={legendItems} />}
							wrapperStyle={{ outline: "none" }}
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
