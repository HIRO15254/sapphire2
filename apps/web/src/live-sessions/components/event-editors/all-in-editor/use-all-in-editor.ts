import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

const allInSchema = z.object({
	time: z.string(),
	potSize: requiredNumericString({ min: 0 }),
	trials: requiredNumericString({ integer: true, min: 1 }),
	equity: requiredNumericString({ min: 0, max: 100 }),
	wins: requiredNumericString({ min: 0 }),
});

interface UseAllInEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useAllInEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseAllInEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			potSize:
				typeof payload.potSize === "number" ? String(payload.potSize) : "0",
			trials: typeof payload.trials === "number" ? String(payload.trials) : "1",
			equity: typeof payload.equity === "number" ? String(payload.equity) : "0",
			wins: typeof payload.wins === "number" ? String(payload.wins) : "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{
					potSize: Number(value.potSize),
					trials: Number(value.trials),
					equity: Number(value.equity),
					wins: Number(value.wins),
				},
				occurredAt
			);
		},
		validators: {
			onSubmit: allInSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
