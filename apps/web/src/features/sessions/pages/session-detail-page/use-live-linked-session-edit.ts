import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import { useSessionEvents } from "@/features/live-sessions/hooks/use-session-events";
import {
	buildLiveLinkedEventEdits,
	findLifecycleEvents,
	type LiveLinkedEventEdit,
	lifecycleDayHints,
	liveLinkedDisabledResultFields,
	liveLinkedRequiredResultFields,
} from "@/features/sessions/utils/live-linked-edit";
import type { SessionFormValues } from "@/features/sessions/utils/session-form-helpers";

const NO_DISABLED_FIELDS: ReadonlySet<string> = new Set();
const NO_REQUIRED_FIELDS: ReadonlySet<string> = new Set();

export function useLiveLinkedSessionEdit({
	displayedDate,
	isEditOpen,
	isLiveLinked,
	sessionId,
	sessionType,
}: {
	displayedDate: string;
	isEditOpen: boolean;
	isLiveLinked: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}) {
	const { events, isUpdatePending, update } = useSessionEvents({
		sessionId: isLiveLinked ? sessionId : "",
		sessionType,
	});

	const seedEventsRef = useRef<SessionEvent[] | null>(null);
	const seedDisplayedDateRef = useRef<string | null>(null);
	useEffect(() => {
		if (!isEditOpen) {
			seedEventsRef.current = null;
			seedDisplayedDateRef.current = null;
			return;
		}
		if (seedEventsRef.current === null && events.length > 0) {
			seedEventsRef.current = events;
		}
		if (seedDisplayedDateRef.current === null && displayedDate !== "") {
			seedDisplayedDateRef.current = displayedDate;
		}
	}, [displayedDate, events, isEditOpen]);

	const { sessionEnd, sessionStart } = findLifecycleEvents(events);
	const disabledResultFields = isLiveLinked
		? liveLinkedDisabledResultFields({
				hasSessionEnd: sessionEnd !== null,
				hasSessionStart: sessionStart !== null,
				type: sessionType,
			})
		: NO_DISABLED_FIELDS;

	const applyEdits = async (edits: LiveLinkedEventEdit[]) => {
		for (const edit of edits) {
			await update(edit);
		}
	};

	const submitLiveEventEdits = async (
		values: SessionFormValues
	): Promise<boolean> => {
		if (!isLiveLinked) {
			return true;
		}
		const { edits, errors } = buildLiveLinkedEventEdits({
			events,
			seedEvents: seedEventsRef.current ?? events,
			values,
		});
		const firstError = errors[0];
		if (firstError !== undefined) {
			toast.error(firstError);
			return false;
		}
		try {
			await applyEdits(edits);
		} catch {
			return false;
		}
		return true;
	};

	const dayHints = isLiveLinked
		? lifecycleDayHints({
				displayedDate: seedDisplayedDateRef.current ?? displayedDate,
				events,
			})
		: { end: null, start: null };

	return {
		disabledResultFields,
		endDateHint: dayHints.end,
		isEventUpdatePending: isUpdatePending,
		requiredResultFields: isLiveLinked
			? liveLinkedRequiredResultFields({
					hasSessionEnd: sessionEnd !== null,
					hasSessionStart: sessionStart !== null,
					type: sessionType,
				})
			: NO_REQUIRED_FIELDS,
		startDateHint: dayHints.start,
		submitLiveEventEdits,
	};
}
