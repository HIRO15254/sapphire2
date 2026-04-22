import { useForm } from "@tanstack/react-form";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";

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
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	const textValidator = (value: string) =>
		value.trim().length === 0 ? "Text is required" : undefined;

	return { form, timeValidator, textValidator };
}
