import { useForm } from "@tanstack/react-form";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

interface UseUpdateTournamentInfoEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useUpdateTournamentInfoEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseUpdateTournamentInfoEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
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
			onSubmit(
				{
					remainingPlayers: value.remainingPlayers
						? Number(value.remainingPlayers)
						: null,
					totalEntries: value.totalEntries ? Number(value.totalEntries) : null,
					chipPurchaseCounts: value.chipPurchaseCounts,
				},
				occurredAt
			);
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
