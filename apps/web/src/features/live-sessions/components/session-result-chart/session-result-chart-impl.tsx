import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { formatCompactNumber } from "@/utils/format-number";

const COLOR_CASH = "oklch(0.62 0.21 250)";
const COLOR_TOURNAMENT = "oklch(0.75 0.16 70)";

interface SeriesMeta {
	color: string;
	dashed: boolean;
	dataKey: string;
	name: string;
}

const CASH_SERIES: SeriesMeta[] = [
	{ name: "P&L", dataKey: "pl", color: COLOR_CASH, dashed: false },
	{ name: "EV P&L", dataKey: "evPl", color: COLOR_CASH, dashed: true },
];

const TOURNAMENT_SERIES: SeriesMeta[] = [
	{ name: "Stack", dataKey: "stack", color: COLOR_TOURNAMENT, dashed: false },
	{
		name: "Avg stack",
		dataKey: "averageStack",
		color: COLOR_TOURNAMENT,
		dashed: true,
	},
];

function formatXTick(ms: number): string {
	const totalMinutes = Math.max(0, Math.round(ms / 60_000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}:${String(minutes).padStart(2, "0")}`;
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
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
	if (!(active && payload) || payload.length === 0) {
		return null;
	}
	return (
		<div className="rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-md">
			{typeof label === "number" ? (
				<div className="text-muted-foreground">{formatXTick(label)}</div>
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

function CustomLegend({ items }: { items: SeriesMeta[] }) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px]">
			{items.map((item) => (
				<div className="flex items-center gap-1.5" key={item.dataKey}>
					<svg
						aria-hidden="true"
						className="shrink-0"
						height={6}
						viewBox="0 0 14 6"
						width={14}
					>
						<line
							stroke={item.color}
							strokeDasharray={item.dashed ? "3 2" : undefined}
							strokeWidth={2}
							x1={0}
							x2={14}
							y1={3}
							y2={3}
						/>
					</svg>
					<span className="text-foreground">{item.name}</span>
				</div>
			))}
		</div>
	);
}

interface ChartPoint {
	averageStack?: number | null;
	evPl?: number;
	pl?: number;
	stack?: number;
	t: number;
}

interface SessionResultChartImplProps {
	points: ChartPoint[];
	sessionType: "cash_game" | "tournament";
}

function activeSeries(
	sessionType: "cash_game" | "tournament",
	points: ChartPoint[]
): SeriesMeta[] {
	if (sessionType === "cash_game") {
		return CASH_SERIES;
	}
	const hasAverage = points.some((p) => p.averageStack != null);
	return hasAverage ? TOURNAMENT_SERIES : [TOURNAMENT_SERIES[0]];
}

export default function SessionResultChartImpl({
	points,
	sessionType,
}: SessionResultChartImplProps) {
	const series = activeSeries(sessionType, points);
	const isCash = sessionType === "cash_game";
	return (
		<div className="h-full w-full">
			<ResponsiveContainer height="100%" width="100%">
				<LineChart
					data={points}
					margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
				>
					<CartesianGrid className="stroke-border" strokeDasharray="3 3" />
					<XAxis
						dataKey="t"
						domain={["dataMin", "dataMax"]}
						tick={{ fontSize: 10 }}
						tickFormatter={(v: number) => formatXTick(v)}
						type="number"
					/>
					<YAxis
						tick={{ fontSize: 10 }}
						tickFormatter={(v: number) => formatCompactNumber(v)}
						width={50}
					/>
					{isCash ? (
						<ReferenceLine
							className="stroke-muted-foreground"
							strokeDasharray="2 2"
							y={0}
						/>
					) : null}
					<Tooltip
						content={(props) => (
							<CustomTooltip
								active={props.active}
								label={props.label as number | string | undefined}
								payload={
									props.payload as readonly TooltipPayloadItem[] | undefined
								}
							/>
						)}
						cursor={false}
						wrapperStyle={{ outline: "none" }}
					/>
					<Legend
						content={() => <CustomLegend items={series} />}
						wrapperStyle={{ outline: "none" }}
					/>
					{series.map((s) => (
						<Line
							connectNulls
							dataKey={s.dataKey}
							dot={false}
							isAnimationActive={false}
							key={s.dataKey}
							name={s.name}
							stroke={s.color}
							strokeDasharray={s.dashed ? "4 4" : undefined}
							strokeWidth={2}
							type="linear"
						/>
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
