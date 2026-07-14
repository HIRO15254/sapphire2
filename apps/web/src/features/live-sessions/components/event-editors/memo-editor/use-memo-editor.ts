import { useForm } from "@tanstack/react-form";
import z from "zod";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";

const memoSchema = z.object({
	time: z.string(),
	text: z.string().trim().min(1, "Text is required"),
});

interface UseMemoEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onSubmit: (payload: unknown, occurredAt?: number) => void;
}

export function useMemoEditor({
	event,
	maxTime,
	minTime,
	onSubmit,
}: UseMemoEditorOptions) {
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			text: typeof payload.text === "string" ? payload.text : "",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit({ text: value.text }, occurredAt);
		},
		validators: {
			onSubmit: memoSchema,
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	const textValidator = (value: string) =>
		value.trim().length === 0 ? "Text is required" : undefined;

	return { form, timeValidator, textValidator };
}
