import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import { optionalNumericString } from "@/shared/lib/form-fields";
import {
	type GlobalFilterWidgetSessionType,
	parseGlobalFilterWidgetConfig,
} from "./use-global-filter-widget";

const TYPE_VALUES = ["all", "cash_game", "tournament"] as const;

const editFormSchema = z.object({
	type: z.enum(TYPE_VALUES),
	dateRangeDays: optionalNumericString({ integer: true, min: 1, max: 3650 }),
});

interface UseGlobalFilterEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

export function useGlobalFilterEditForm({
	config,
	onSave,
}: UseGlobalFilterEditFormOptions) {
	const parsed = parseGlobalFilterWidgetConfig(config);
	const form = useForm({
		defaultValues: {
			type: parsed.type as GlobalFilterWidgetSessionType,
			dateRangeDays:
				parsed.dateRangeDays === null ? "" : String(parsed.dateRangeDays),
		},
		onSubmit: async ({ value }) => {
			const trimmed = value.dateRangeDays.trim();
			await onSave({
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
