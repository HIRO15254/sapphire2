import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

const chipsAddRemoveSchema = z.object({
	time: z.string(),
	amount: requiredNumericString({ integer: true, min: 0 }),
	type: z.enum(["add", "remove"]),
});

interface UseChipsAddRemoveEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useChipsAddRemoveEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseChipsAddRemoveEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			amount: typeof payload.amount === "number" ? String(payload.amount) : "0",
			type: (payload.type === "remove" ? "remove" : "add") as "add" | "remove",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{ amount: Math.round(Number(value.amount)), type: value.type },
				occurredAt
			);
		},
		validators: {
			onSubmit: chipsAddRemoveSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
