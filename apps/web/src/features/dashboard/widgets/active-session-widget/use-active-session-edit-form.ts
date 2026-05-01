import { useForm } from "@tanstack/react-form";
import z from "zod";
import { SESSION_TYPE_VALUES } from "@/features/dashboard/utils/session-filter";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import {
	type ActiveSessionWidgetSessionType,
	parseActiveSessionWidgetConfig,
} from "./use-active-session-widget";

const editFormSchema = z.object({
	type: z.enum(SESSION_TYPE_VALUES),
});

interface UseActiveSessionEditFormOptions {
	config: WidgetEditProps["config"];
	onSave: WidgetEditProps["onSave"];
}

export function useActiveSessionEditForm({
	config,
	onSave,
}: UseActiveSessionEditFormOptions) {
	const parsed = parseActiveSessionWidgetConfig(config);
	const form = useForm({
		defaultValues: {
			type: parsed.type as ActiveSessionWidgetSessionType,
		},
		onSubmit: async ({ value }) => {
			await onSave({ type: value.type });
		},
		validators: {
			onSubmit: editFormSchema,
		},
	});

	return { form };
}
