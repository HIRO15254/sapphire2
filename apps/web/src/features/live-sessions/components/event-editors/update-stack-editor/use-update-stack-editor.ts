import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";
import { requiredNumericString } from "@/shared/lib/form-fields";

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

const chipPurchaseCountSchema = z.object({
	chipsPerUnit: z.number().int().min(0),
	count: z.number().int().min(0),
	name: z.string().min(1),
});

const updateStackSchema = z.object({
	time: z.string(),
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
	remainingPlayers: z.string(),
	totalEntries: z.string(),
	chipPurchaseCounts: z.array(chipPurchaseCountSchema),
});

interface UseUpdateStackEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
	sessionType?: "cash_game" | "tournament";
}

export function useUpdateStackEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
	sessionType = "cash_game",
}: UseUpdateStackEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const isTournament = sessionType === "tournament";

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			stackAmount: String(payload.stackAmount ?? 0),
			remainingPlayers:
				typeof payload.remainingPlayers === "number"
					? String(payload.remainingPlayers)
					: "",
			totalEntries:
				typeof payload.totalEntries === "number"
					? String(payload.totalEntries)
					: "",
			chipPurchaseCounts: Array.isArray(payload.chipPurchaseCounts)
				? (payload.chipPurchaseCounts as ChipPurchaseCount[])
				: ([] as ChipPurchaseCount[]),
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			const result: Record<string, unknown> = {
				stackAmount: Number(value.stackAmount),
			};
			if (isTournament) {
				if (value.remainingPlayers !== "") {
					result.remainingPlayers = Number(value.remainingPlayers);
				}
				if (value.totalEntries !== "") {
					result.totalEntries = Number(value.totalEntries);
				}
				if (value.chipPurchaseCounts.length > 0) {
					result.chipPurchaseCounts = value.chipPurchaseCounts;
				}
			}
			onSubmit(result, occurredAt);
		},
		validators: {
			onSubmit: updateStackSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator, isTournament };
}
