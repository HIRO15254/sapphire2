import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	type SessionEvent,
	useSessionEvents,
} from "@/features/live-sessions/hooks/use-session-events";
import {
	formatEventLabel,
	getTimeBounds,
} from "@/features/live-sessions/utils/session-events-formatters";
import { useTablePlayers } from "@/features/players/hooks/use-table-players";
import { trpc } from "@/utils/trpc";
import { buildTimelineItem } from "./build-timeline-item";

type SessionType = "cash_game" | "tournament";

export interface UseTimelineSheetOptions {
	open: boolean;
	sessionId: string;
	sessionType: SessionType;
}

export function useTimelineSheet({
	open,
	sessionId,
	sessionType,
}: UseTimelineSheetOptions) {
	const [editEvent, setEditEvent] = useState<SessionEvent | null>(null);
	const effectiveSessionId = open ? sessionId : "";

	const eventsQueryInput =
		sessionType === "tournament"
			? { liveTournamentSessionId: effectiveSessionId }
			: { liveCashGameSessionId: effectiveSessionId };
	const eventsQueryOptions =
		trpc.sessionEvent.list.queryOptions(eventsQueryInput);
	const eventsStatusQuery = useQuery({
		...eventsQueryOptions,
		enabled: !!effectiveSessionId,
	});

	const { events, update, isUpdatePending } = useSessionEvents({
		sessionId: effectiveSessionId,
		sessionType,
		refetchInterval: open ? 3000 : undefined,
	});

	const tablePlayers = useTablePlayers(
		sessionType === "tournament"
			? { liveTournamentSessionId: effectiveSessionId }
			: { liveCashGameSessionId: effectiveSessionId }
	);

	const playerNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const item of tablePlayers.players) {
			map.set(item.player.id, item.player.name);
		}
		return map;
	}, [tablePlayers.players]);

	const items = useMemo(
		() =>
			events.map((event) =>
				buildTimelineItem(event, playerNameById, setEditEvent)
			),
		[events, playerNameById]
	);

	const timeBounds = editEvent
		? getTimeBounds(events, editEvent.id)
		: { minTime: null, maxTime: null };

	const onEditOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setEditEvent(null);
		}
	};

	const onEditSubmit = (payload: unknown, occurredAt?: number) => {
		if (!editEvent) {
			return;
		}
		update({ id: editEvent.id, payload, occurredAt }).then(() =>
			setEditEvent(null)
		);
	};

	const onEditTimeUpdate = (occurredAt: number) => {
		if (!editEvent) {
			return;
		}
		update({ id: editEvent.id, occurredAt }).then(() => setEditEvent(null));
	};

	return {
		items,
		isLoading: eventsStatusQuery.isLoading,
		editEvent,
		editEventTitle: editEvent
			? `Edit ${formatEventLabel(editEvent.eventType)}`
			: "",
		onEditOpenChange,
		onEditSubmit,
		onEditTimeUpdate,
		isUpdatePending,
		timeBounds,
	};
}
