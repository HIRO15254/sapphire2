import { toast } from "sonner";
import { useSessionEvents } from "@/features/live-sessions/hooks/use-session-events";
import {
	buildLiveLinkedEventEdits,
	findLifecycleEvents,
	type LiveLinkedEventEdit,
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
	isLiveLinked,
	sessionId,
	sessionType,
}: {
	isLiveLinked: boolean;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
}) {
	// An empty id keeps the underlying query disabled for manual sessions.
	const { events, isUpdatePending, update } = useSessionEvents({
		sessionId: isLiveLinked ? sessionId : "",
		sessionType,
	});

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
		const { edits, errors } = buildLiveLinkedEventEdits({ events, values });
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

	return {
		disabledResultFields,
		isEventUpdatePending: isUpdatePending,
		submitLiveEventEdits,
	};
}
