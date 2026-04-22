import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import { requiredNumericString } from "@/shared/lib/form-fields";

const cashGameStartSchema = z.object({
	time: z.string(),
	buyInAmount: requiredNumericString({ integer: true, min: 0 }),
});

const tournamentStartSchema = z.object({
	time: z.string(),
	timerStartedAt: z.string(),
});

function toDatetimeLocalValue(value: Date | string | number | null): string {
	if (value === null || value === undefined) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTimerSeconds(value: string): number | null {
	if (!value) {
		return null;
	}
	const ms = new Date(value).getTime();
	if (Number.isNaN(ms)) {
		return null;
	}
	return Math.floor(ms / 1000);
}

interface UseSessionStartEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useCashGameStartEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseSessionStartEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			buyInAmount:
				typeof payload.buyInAmount === "number"
					? String(payload.buyInAmount)
					: "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit({ buyInAmount: Number(value.buyInAmount) }, occurredAt);
		},
		validators: {
			onSubmit: cashGameStartSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}

export function useTournamentStartEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseSessionStartEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;
	const initialTimer =
		typeof payload.timerStartedAt === "number"
			? toDatetimeLocalValue(payload.timerStartedAt * 1000)
			: "";

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			timerStartedAt: initialTimer,
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{ timerStartedAt: toTimerSeconds(value.timerStartedAt) },
				occurredAt
			);
		},
		validators: {
			onSubmit: tournamentStartSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
