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
	return formatCompactNumber(value);
}

function formatTooltipLabel(value: number, xAxis: PnlGraphXAxis): string {
	if (xAxis === "date") {
		return new Date(value).toISOString().slice(0, 10);
	}
	if (xAxis === "playTime") {
		return `${value.toFixed(0)} min`;
	}
	return `Session ${value}`;
}

interface PnlGraphChartProps {
	points: { cumulative: number; x: number }[];
	xAxisType: PnlGraphXAxis;
}

export default function PnlGraphChart({
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
				<YAxis
					tick={{ fontSize: 10 }}
					tickFormatter={(v: number) => formatCompactNumber(v)}
					width={50}
				/>
				<Tooltip
					formatter={(value) =>
						typeof value === "number" ? formatCompactNumber(value) : ""
					}
					labelFormatter={(label) =>
						typeof label === "number"
							? formatTooltipLabel(label, xAxisType)
							: ""
					}
				/>
				<Line
					className="stroke-primary"
					dataKey="cumulative"
					dot={false}
					isAnimationActive={false}
					strokeWidth={2}
					type="monotone"
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}
