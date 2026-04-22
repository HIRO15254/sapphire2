import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { WidgetEditProps } from "@/features/dashboard/widgets/registry";
import {
	type ActiveSessionWidgetSessionType,
	parseActiveSessionWidgetConfig,
} from "./use-active-session-widget";

const SESSION_TYPE_VALUES = ["all", "cash_game", "tournament"] as const;

const editFormSchema = z.object({
	sessionType: z.enum(SESSION_TYPE_VALUES),
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
			sessionType: parsed.sessionType as ActiveSessionWidgetSessionType,
		},
		onSubmit: async ({ value }) => {
			await onSave({ sessionType: value.sessionType });
		},
		validators: {
			onSubmit: editFormSchema,
		},
	});

	return { form };
}
