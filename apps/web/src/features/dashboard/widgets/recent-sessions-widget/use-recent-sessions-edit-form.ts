import { useForm } from "@tanstack/react-form";
import z from "zod";
import { SESSION_TYPE_VALUES } from "@/features/dashboard/utils/session-filter";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { requiredNumericString } from "@/shared/lib/form-fields";
import {
	parseRecentSessionsWidgetConfig,
	type RecentSessionsWidgetTypeFilter,
} from "./use-recent-sessions-widget";

const editFormSchema = z.object({
	limit: requiredNumericString({ integer: true, min: 1, max: 20 }),
	type: z.enum(SESSION_TYPE_VALUES),
});

interface UseRecentSessionsEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

export function useRecentSessionsEditForm({
	config,
	onSave,
}: UseRecentSessionsEditFormOptions) {
	const parsed = parseRecentSessionsWidgetConfig(config);
	const form = useForm({
		defaultValues: {
			limit: String(parsed.limit),
			type: parsed.type as RecentSessionsWidgetTypeFilter,
		},
		onSubmit: async ({ value }) => {
			await onSave({
				limit: Number.parseInt(value.limit, 10),
				type: value.type,
			});
		},
		validators: {
			onSubmit: editFormSchema,
		},
	});

	return { form };
}
