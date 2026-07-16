import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

const virtualAmountEditorSchema = z.object({
	time: z.string(),
	value: requiredNumericString({ integer: true, min: 1 }),
});

interface UseVirtualAmountEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

/**
 * Edits a virtual_buy_in / virtual_cash_out event. Item-based events keep
 * their item fixed and edit the count (the server re-resolves the snapshot
 * fields authoritatively); pure-virtual events edit the free amount.
 */
export function useVirtualAmountEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseVirtualAmountEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const itemId = typeof payload.itemId === "string" ? payload.itemId : null;
	const itemName =
		typeof payload.itemName === "string" ? payload.itemName : null;
	const unitValue =
		typeof payload.unitValue === "number" ? payload.unitValue : 0;
	const currencyId =
		typeof payload.currencyId === "string" ? payload.currencyId : null;
	const isItemBased = itemId !== null;

	const initialValue = isItemBased
		? (typeof payload.count === "number" ? payload.count : 1)
		: (typeof payload.amount === "number" ? payload.amount : 0);

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			value: String(initialValue),
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			const parsed = Math.round(Number(value.value));
			if (isItemBased) {
				onSubmit(
					{
						amount: parsed * unitValue,
						itemId,
						itemName,
						count: parsed,
						unitValue,
						currencyId,
					},
					occurredAt
				);
				return;
			}
			onSubmit(
				{
					amount: parsed,
					itemId: null,
					itemName: null,
					count: null,
					unitValue: null,
					currencyId: null,
				},
				occurredAt
			);
		},
		validators: {
			onSubmit: virtualAmountEditorSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, isItemBased, itemName, timeValidator };
}
