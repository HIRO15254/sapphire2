import type {
	WidgetEditProps,
	WidgetRenderProps,
} from "@/features/dashboard/widgets/registry";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { useSummaryStatsEditForm } from "./use-summary-stats-edit-form";
import {
	SUMMARY_STATS_ALL_METRICS,
	type SummaryStatsMetricKey,
	type SummaryStatsSummary,
	useSummaryStatsWidget,
} from "./use-summary-stats-widget";

function formatMetricValue(
	key: SummaryStatsMetricKey,
	summary: SummaryStatsSummary
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
	key: SummaryStatsMetricKey,
	summary: SummaryStatsSummary
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
	const { isLoading, metrics, summary } = useSummaryStatsWidget(config);

	if (isLoading) {
		return (
			<div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
				{metrics.map((m) => (
					<Skeleton className="h-14" key={m} />
				))}
			</div>
		);
	}

	if (!summary || summary.totalSessions === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-muted-foreground text-sm">
				No sessions yet
			</div>
		);
	}

	return (
		<div className="grid h-full grid-cols-2 gap-2 overflow-auto p-2 sm:grid-cols-3">
			{metrics.map((key) => {
				const label =
					SUMMARY_STATS_ALL_METRICS.find((am) => am.key === key)?.label ?? key;
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
	const { form } = useSummaryStatsEditForm({ config, onSave });

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="metrics">
				{(field) => (
					<Field label="Metrics">
						<div className="grid grid-cols-2 gap-2">
							{SUMMARY_STATS_ALL_METRICS.map((m) => {
								const id = `summary-stats-metric-${m.key}`;
								const checked = field.state.value.includes(m.key);
								return (
									<div className="flex items-center gap-2" key={m.key}>
										<Checkbox
											checked={checked}
											id={id}
											onCheckedChange={(next) => {
												if (next === true) {
													field.handleChange(
														field.state.value.includes(m.key)
															? field.state.value
															: [...field.state.value, m.key]
													);
												} else {
													field.handleChange(
														field.state.value.filter((k) => k !== m.key)
													);
												}
											}}
										/>
										<Label className="cursor-pointer text-sm" htmlFor={id}>
											{m.label}
										</Label>
									</div>
								);
							})}
						</div>
					</Field>
				)}
			</form.Field>
			<form.Field name="type">
				{(field) => (
					<Field htmlFor={field.name} label="Session Type">
						<Select
							onValueChange={(value) =>
								field.handleChange(value as typeof field.state.value)
							}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="cash_game">Cash Game</SelectItem>
								<SelectItem value="tournament">Tournament</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
			<form.Field name="dateRangeDays">
				{(field) => (
					<Field
						description="空のまま保存すると全期間になります"
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Date Range (days)"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<DialogActionRow>
				<Button onClick={onCancel} type="button" variant="outline">
					Cancel
				</Button>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button disabled={!canSubmit || isSubmitting} type="submit">
							{isSubmitting ? "Saving..." : "Save"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
