import { useForm } from "@tanstack/react-form";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/utils/stack-editor-time";

interface UseTimeOnlyEditorOptions {
	event: SessionEvent;
	isLoading: boolean;
	maxTime: Date | null;
	minTime: Date | null;
	onTimeUpdate: (occurredAt: number) => void;
}

export function useTimeOnlyEditor({
	event,
	maxTime,
	minTime,
	onTimeUpdate,
}: UseTimeOnlyEditorOptions) {
	const form = useForm({
		defaultValues: { time: toTimeInputValue(event.occurredAt) },
		onSubmit: ({ value }) => {
			const ts = toOccurredAtTimestamp(event.occurredAt, value.time);
			if (ts !== undefined) {
				onTimeUpdate(ts);
			}
		},
	});

	const timeValidator = (value: string) =>
		validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
		undefined;

	return { form, timeValidator };
}
