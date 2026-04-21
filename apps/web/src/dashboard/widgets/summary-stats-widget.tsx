import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

type StatsType = "all" | "cash_game" | "tournament";

type MetricKey =
	| "totalSessions"
	| "totalProfitLoss"
	| "winRate"
	| "avgProfitLoss"
	| "totalEvProfitLoss"
	| "totalEvDiff";

const ALL_METRICS: Array<{ key: MetricKey; label: string }> = [
	{ key: "totalSessions", label: "Total Sessions" },
	{ key: "totalProfitLoss", label: "Total P&L" },
	{ key: "winRate", label: "Win Rate" },
	{ key: "avgProfitLoss", label: "Avg P&L" },
	{ key: "totalEvProfitLoss", label: "Total EV P&L" },
	{ key: "totalEvDiff", label: "Total EV Diff" },
];

const DEFAULT_METRICS: MetricKey[] = [
	"totalSessions",
	"totalProfitLoss",
	"winRate",
	"avgProfitLoss",
];

interface ParsedConfig {
	dateRangeDays: number | null;
	metrics: MetricKey[];
	type: StatsType;
}

function parseConfig(raw: Record<string, unknown>): ParsedConfig {
	const metricsRaw = Array.isArray(raw.metrics) ? raw.metrics : [];
	const metrics = metricsRaw.filter((m): m is MetricKey =>
		ALL_METRICS.some((am) => am.key === m)
	);
	const type =
		raw.type === "cash_game" || raw.type === "tournament"
			? (raw.type as StatsType)
			: ("all" as StatsType);
	const dateRangeDays =
		typeof raw.dateRangeDays === "number" ? raw.dateRangeDays : null;
	return {
		metrics: metrics.length > 0 ? metrics : DEFAULT_METRICS,
		type,
		dateRangeDays,
	};
}

function formatMetricValue(
	key: MetricKey,
	summary: {
		totalSessions: number;
		totalProfitLoss: number;
		winRate: number;
		avgProfitLoss: number | null;
		totalEvProfitLoss: number | null;
		totalEvDiff: number | null;
	}
): string {
	switch (key) {
		case "totalSessions":
			return summary.totalSessions.toString();
		case "totalProfitLoss":
			return formatProfitLoss(summary.totalProfitLoss);
		case "winRate":
			return `${summary.winRate.toFixed(1)}%`;
		case "avgProfitLoss":
			return formatProfitLoss(
				summary.avgProfitLoss === null
					? null
					: Math.round(summary.avgProfitLoss)
			);
		case "totalEvProfitLoss":
			return formatProfitLoss(summary.totalEvProfitLoss);
		case "totalEvDiff":
			return formatProfitLoss(summary.totalEvDiff);
		default:
			return "—";
	}
}

function metricColor(
	key: MetricKey,
	summary: {
		totalProfitLoss: number;
		avgProfitLoss: number | null;
		totalEvProfitLoss: number | null;
		totalEvDiff: number | null;
	}
): string {
	switch (key) {
		case "totalProfitLoss":
			return profitLossColorClass(summary.totalProfitLoss);
		case "avgProfitLoss":
			return profitLossColorClass(summary.avgProfitLoss);
		case "totalEvProfitLoss":
			return profitLossColorClass(summary.totalEvProfitLoss);
		case "totalEvDiff":
			return profitLossColorClass(summary.totalEvDiff);
		default:
			return "";
	}
}

export function SummaryStatsWidget({ config }: WidgetRenderProps) {
	const parsed = parseConfig(config);
	const dateFrom =
		parsed.dateRangeDays === null
			? undefined
			: Math.floor(Date.now() / 1000) - parsed.dateRangeDays * 86_400;

	const query = useQuery(
		trpc.session.list.queryOptions({
			type: parsed.type === "all" ? undefined : parsed.type,
			dateFrom,
		})
	);

	if (query.isLoading) {
		return (
			<div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
				{parsed.metrics.map((m) => (
					<Skeleton className="h-14" key={m} />
				))}
			</div>
		);
	}

	const summary = query.data?.summary;
	if (!summary || summary.totalSessions === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				No sessions yet
			</div>
		);
	}

	return (
		<div className="grid h-full grid-cols-2 gap-2 overflow-auto p-2 sm:grid-cols-3">
			{parsed.metrics.map((key) => {
				const label = ALL_METRICS.find((am) => am.key === key)?.label ?? key;
				const value = formatMetricValue(key, summary);
				const colorClass = metricColor(key, summary);
				return (
					<div
						className="flex flex-col gap-0.5 rounded-md border px-3 py-2"
						key={key}
					>
						<span className="text-muted-foreground text-xs">{label}</span>
						<span className={`font-semibold text-sm ${colorClass}`}>
							{value}
						</span>
					</div>
				);
			})}
		</div>
	);
}

export function SummaryStatsEditForm({
	config,
	onSave,
	onCancel,
}: WidgetEditProps) {
	const parsed = parseConfig(config);
	const [metrics, setMetrics] = useState<MetricKey[]>(parsed.metrics);
	const [type, setType] = useState<StatsType>(parsed.type);
	const [dateRangeDays, setDateRangeDays] = useState<number | null>(
		parsed.dateRangeDays
	);
	const [isSaving, setIsSaving] = useState(false);

	const toggleMetric = (key: MetricKey) => {
		setMetrics((prev) =>
			prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
		);
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await onSave({
				metrics: metrics.length > 0 ? metrics : DEFAULT_METRICS,
				type,
				dateRangeDays,
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Metrics</Label>
				<div className="grid grid-cols-2 gap-2">
					{ALL_METRICS.map((m) => (
						<label
							className="flex cursor-pointer items-center gap-2 text-sm"
							key={m.key}
						>
							<input
								checked={metrics.includes(m.key)}
								onChange={() => toggleMetric(m.key)}
								type="checkbox"
							/>
							<span>{m.label}</span>
						</label>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="summary-stats-type">Session Type</Label>
				<select
					className="rounded-md border bg-background px-3 py-2 text-sm"
					id="summary-stats-type"
					onChange={(e) => setType(e.target.value as StatsType)}
					value={type}
				>
					<option value="all">All</option>
					<option value="cash_game">Cash Game</option>
					<option value="tournament">Tournament</option>
				</select>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="summary-stats-range">Date Range (days)</Label>
				<input
					className="rounded-md border bg-background px-3 py-2 text-sm"
					id="summary-stats-range"
					min={1}
					onChange={(e) => {
						const value = e.target.value;
						setDateRangeDays(value === "" ? null : Number(value));
					}}
					placeholder="All time"
					type="number"
					value={dateRangeDays ?? ""}
				/>
			</div>
			<DialogActionRow>
				<Button onClick={onCancel} variant="outline">
					Cancel
				</Button>
				<Button disabled={isSaving} onClick={handleSave}>
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</DialogActionRow>
		</div>
	);
}
