import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

const purchaseChipsSchema = z.object({
	time: z.string(),
	name: z.string().min(1, "Name is required"),
	cost: requiredNumericString({ integer: true, min: 0 }),
	chips: requiredNumericString({ integer: true, min: 0 }),
});

interface UsePurchaseChipsEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function usePurchaseChipsEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UsePurchaseChipsEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			name: typeof payload.name === "string" ? payload.name : "",
			cost: typeof payload.cost === "number" ? String(payload.cost) : "0",
			chips: typeof payload.chips === "number" ? String(payload.chips) : "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{
					name: value.name,
					cost: Math.round(Number(value.cost)),
					chips: Math.round(Number(value.chips)),
				},
				occurredAt
			);
		},
		validators: {
			onSubmit: purchaseChipsSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
