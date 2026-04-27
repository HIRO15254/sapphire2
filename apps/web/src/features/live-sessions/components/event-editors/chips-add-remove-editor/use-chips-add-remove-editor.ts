import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

const chipsAddRemoveSchema = z.object({
	time: z.string(),
	amount: requiredNumericString({ integer: true, min: 1 }),
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
	const initialAmount = typeof payload.amount === "number" ? payload.amount : 0;
	const initialType: "add" | "remove" = initialAmount < 0 ? "remove" : "add";

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			amount: String(Math.abs(initialAmount)),
			type: initialType,
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			const magnitude = Math.round(Number(value.amount));
			const signedAmount = value.type === "remove" ? -magnitude : magnitude;
			onSubmit({ amount: signedAmount }, occurredAt);
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
