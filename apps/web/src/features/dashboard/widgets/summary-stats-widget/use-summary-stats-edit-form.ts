import { useForm } from "@tanstack/react-form";
import z from "zod";
import { SESSION_TYPE_VALUES } from "@/features/dashboard/utils/session-filter";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { optionalNumericString } from "@/shared/lib/form-fields";
import {
	parseSummaryStatsWidgetConfig,
	SUMMARY_STATS_DEFAULT_METRICS,
	type SummaryStatsMetricKey,
	type SummaryStatsWidgetType,
} from "./use-summary-stats-widget";

const METRIC_VALUES: readonly SummaryStatsMetricKey[] = [
	"totalSessions",
	"totalProfitLoss",
	"winRate",
	"avgProfitLoss",
	"totalEvProfitLoss",
	"totalEvDiff",
] as const;

const editFormSchema = z.object({
	metrics: z.array(z.enum(METRIC_VALUES)),
	type: z.enum(SESSION_TYPE_VALUES),
	dateRangeDays: optionalNumericString({ integer: true, min: 1 }),
});

interface UseSummaryStatsEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

export function useSummaryStatsEditForm({
	config,
	onSave,
}: UseSummaryStatsEditFormOptions) {
	const parsed = parseSummaryStatsWidgetConfig(config);
	const form = useForm({
		defaultValues: {
			metrics: parsed.metrics,
			type: parsed.type as SummaryStatsWidgetType,
			dateRangeDays:
				parsed.dateRangeDays === null ? "" : String(parsed.dateRangeDays),
		},
		onSubmit: async ({ value }) => {
			const trimmed = value.dateRangeDays.trim();
			await onSave({
				metrics:
					value.metrics.length > 0
						? value.metrics
						: SUMMARY_STATS_DEFAULT_METRICS,
				type: value.type,
				dateRangeDays: trimmed === "" ? null : Number.parseInt(trimmed, 10),
			});
		},
		validators: {
			onSubmit: editFormSchema,
		},
	});

	return { form };
}
