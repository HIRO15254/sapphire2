import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

const updateStackSchema = z.object({
	time: z.string(),
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
});

interface UseUpdateStackEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useUpdateStackEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseUpdateStackEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			stackAmount: String(payload.stackAmount ?? 0),
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit({ stackAmount: Number(value.stackAmount) }, occurredAt);
		},
		validators: {
			onSubmit: updateStackSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
