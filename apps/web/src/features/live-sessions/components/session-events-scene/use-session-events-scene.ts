import { useMemo, useState } from "react";
import {
	type SessionEvent,
	useSessionEvents,
} from "@/features/live-sessions/hooks/use-session-events";
import {
	getTimeBounds,
	groupEventsForDisplay,
} from "@/features/live-sessions/utils/session-events-formatters";

type SessionType = "cash_game" | "tournament";

interface UseSessionEventsSceneOptions {
	refetchInterval?: number;
	sessionId: string;
	sessionType: SessionType;
}

export function useSessionEventsScene({
	refetchInterval,
	sessionId,
	sessionType,
}: UseSessionEventsSceneOptions) {
	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const {
		events,
		update,
		delete: deleteEvent,
		isUpdatePending,
	} = useSessionEvents({
		sessionId,
		sessionType,
		refetchInterval,
	});

	const groups = useMemo(() => groupEventsForDisplay(events), [events]);

	const timeBounds = editEvent
		? getTimeBounds(events, editEvent.id)
		: { minTime: null, maxTime: null };

	return {
		editEvent,
		setEditEvent,
		confirmingDeleteId,
		setConfirmingDeleteId,
		events,
		update,
		deleteEvent,
		isUpdatePending,
		groups,
		timeBounds,
	};
}
