import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

// `wins` is a non-negative integer that must not exceed `trials` (SA2-156),
// mirroring the server-side `allInPayload` guard so editing an existing all-in
// event cannot reintroduce EV-corrupting values. The integer check is done in
// the refine (not via the field's `integer` rule) because
// `requiredNumericString`'s integer mode truncates "1.5" to 1 rather than
// rejecting it; both issues attach to the `wins` field path.
const allInSchema = z
	.object({
		time: z.string(),
		potSize: requiredNumericString({ min: 0 }),
		trials: requiredNumericString({ integer: true, min: 1 }),
		equity: requiredNumericString({ min: 0, max: 100 }),
		wins: requiredNumericString({ min: 0 }),
	})
	.superRefine((value, ctx) => {
		const wins = Number(value.wins.trim());
		if (value.wins.trim() === "" || !Number.isFinite(wins)) {
			return;
		}
		if (!Number.isInteger(wins)) {
			ctx.addIssue({
				code: "custom",
				message: "Wins must be a whole number",
				path: ["wins"],
			});
			return;
		}
		const trials = Number.parseInt(value.trials.trim(), 10);
		if (Number.isFinite(trials) && wins > trials) {
			ctx.addIssue({
				code: "custom",
				message: "Wins must not exceed trials",
				path: ["wins"],
			});
		}
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
