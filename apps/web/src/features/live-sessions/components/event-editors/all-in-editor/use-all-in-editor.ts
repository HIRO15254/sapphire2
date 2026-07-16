import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import { refineWinsNotExceedingTrials } from "@/features/live-sessions/utils/all-in-validation";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

// `wins <= trials` is enforced through the shared refineWinsNotExceedingTrials so
// editing an existing all-in event stays in lockstep with the create sheet and
// the server-side allInPayload refine (SA2-156). `wins` may be fractional (a
// chopped pot counts as a partial win), so only the upper bound is checked.
const allInSchema = z
	.object({
		time: z.string(),
		potSize: requiredNumericString({ integer: true, min: 0 }),
		trials: requiredNumericString({ integer: true, min: 1 }),
		equity: requiredNumericString({ min: 0, max: 100 }),
		wins: requiredNumericString({ min: 0 }),
	})
	.superRefine(refineWinsNotExceedingTrials);

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
