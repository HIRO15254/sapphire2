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
} from "@/features/sessions/utils/live-linked-edit";
import type { SessionFormValues } from "@/features/sessions/utils/session-form-helpers";

const NO_DISABLED_FIELDS: ReadonlySet<string> = new Set();

/**
 * Live-linked half of the session edit sheet.
 *
 * `session.update` refuses every field a live session derives from its events,
 * so the fields that map 1:1 onto a single event value are written through
 * `sessionEvent.update` instead — the server then recalculates the session, and
 * the derived columns can never disagree with the events. Fields whose backing
 * event does not exist (or has not loaded) are reported as disabled so the form
 * never offers an edit that would be rejected.
 */
export function useLiveLinkedSessionEdit({
	displayedDate,
	isEditOpen,
	isLiveLinked,
	sessionId,
	sessionType,
}: {
	/** The form's date input value (`yyyy-MM-dd`), for the day hints. */
	displayedDate: string;
	/** Whether the edit sheet is open — the form seeds when it opens. */
	isEditOpen: boolean;
	isLiveLinked: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}) {
	// An empty id keeps the underlying query disabled for manual sessions.
	const { events, isUpdatePending, update } = useSessionEvents({
		sessionId: isLiveLinked ? sessionId : "",
		sessionType,
	});

	// The events as they were when the sheet opened — the state the form was
	// seeded from. The Events section rendered inside the same sheet edits these
	// events live, so an untouched form field must be diffed against this
	// snapshot; diffing against the refreshed events would make the save undo
	// whatever the user just changed in the Events section. `FormSheet` unmounts
	// its content on close, so the form re-seeds exactly when this is cleared.
	const seedEventsRef = useRef<SessionEvent[] | null>(null);
	useEffect(() => {
		if (!isEditOpen) {
			seedEventsRef.current = null;
			return;
		}
		if (seedEventsRef.current === null && events.length > 0) {
			seedEventsRef.current = events;
		}
	}, [events, isEditOpen]);

	const { sessionEnd, sessionStart } = findLifecycleEvents(events);
	const disabledResultFields = isLiveLinked
		? liveLinkedDisabledResultFields({
				hasSessionEnd: sessionEnd !== null,
				hasSessionStart: sessionStart !== null,
				type: sessionType,
			})
		: NO_DISABLED_FIELDS;

	// Sequential on purpose: `buildLiveLinkedEventEdits` orders the edits so each
	// one satisfies the server's neighbour-ordering check against the state the
	// previous one left behind.
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
			// The shared mutation cache already toasts the server message; the
			// catch only stops the remaining edits and keeps the sheet open.
			return false;
		}
		return true;
	};

	// Non-null only when a lifecycle event sits on another calendar day than the
	// one the form shows, so each time field can say which day it writes to.
	const dayHints = isLiveLinked
		? lifecycleDayHints({ displayedDate, events })
		: { end: null, start: null };

	return {
		disabledResultFields,
		endDateHint: dayHints.end,
		isEventUpdatePending: isUpdatePending,
		startDateHint: dayHints.start,
		submitLiveEventEdits,
	};
}
