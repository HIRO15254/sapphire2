import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

const cashGameEndSchema = z.object({
	time: z.string(),
	cashOutAmount: requiredNumericString({ integer: true, min: 0 }),
});

const tournamentEndSchema = z
	.object({
		time: z.string(),
		beforeDeadline: z.boolean(),
		placement: z.string(),
		totalEntries: z.string(),
		prizeMoney: requiredNumericString({ integer: true, min: 0 }),
		bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
	})
	.superRefine((data, ctx) => {
		if (!data.beforeDeadline) {
			const placementResult = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(data.placement);
			if (!placementResult.success) {
				for (const issue of placementResult.error.issues) {
					ctx.addIssue({ ...issue, path: ["placement"] });
				}
			}
			const totalEntriesResult = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(data.totalEntries);
			if (!totalEntriesResult.success) {
				for (const issue of totalEntriesResult.error.issues) {
					ctx.addIssue({ ...issue, path: ["totalEntries"] });
				}
			}
		}
	});

interface UseSessionEndEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useCashGameEndEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseSessionEndEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			cashOutAmount:
				typeof payload.cashOutAmount === "number"
					? String(payload.cashOutAmount)
					: "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit({ cashOutAmount: Number(value.cashOutAmount) }, occurredAt);
		},
		validators: {
			onSubmit: cashGameEndSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}

export function useTournamentEndEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseSessionEndEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			beforeDeadline: payload.beforeDeadline === true,
			placement:
				typeof payload.placement === "number" ? String(payload.placement) : "",
			totalEntries:
				typeof payload.totalEntries === "number"
					? String(payload.totalEntries)
					: "",
			prizeMoney:
				typeof payload.prizeMoney === "number"
					? String(payload.prizeMoney)
					: "0",
			bountyPrizes:
				typeof payload.bountyPrizes === "number" && payload.bountyPrizes > 0
					? String(payload.bountyPrizes)
					: "",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			if (value.beforeDeadline) {
				onSubmit(
					{
						beforeDeadline: true,
						prizeMoney: Number(value.prizeMoney),
						bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
					},
					occurredAt
				);
			} else {
				onSubmit(
					{
						beforeDeadline: false,
						placement: Number(value.placement),
						totalEntries: Number(value.totalEntries),
						prizeMoney: Number(value.prizeMoney),
						bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
					},
					occurredAt
				);
			}
		},
		validators: {
			onSubmit: tournamentEndSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
