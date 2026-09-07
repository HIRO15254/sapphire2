import {
	isEventAllowedInState,
	type SessionStatus,
} from "@sapphire2/db/constants/session-event-types";
import { useState } from "react";
import type { LoggableEventType } from "@/features/live-sessions/hooks/use-session-event-log";
import { useSessionEventLog } from "@/features/live-sessions/hooks/use-session-event-log";
import { useSessionEvents } from "@/features/live-sessions/hooks/use-session-events";
import { isPersistedEventId } from "@/features/live-sessions/utils/optimistic-session-event";
import { getTimeBounds } from "@/features/live-sessions/utils/session-events-formatters";
import type { EventEditorKind } from "@/features/live-sessions/utils/timeline-view";
import {
	describeTimeline,
	isDeletableEventType,
	resolveEditorKind,
} from "@/features/live-sessions/utils/timeline-view";
import type {
	ChipPurchaseOption,
	EventEditorSubmit,
	EventEditorTarget,
} from "./sheets";
import { NEW_EVENT_TITLES } from "./sheets";

const POLL_MS = 5000;

export type LoggableKind = "allin" | "chips" | "memo" | "purchase";

const LOGGABLE_EVENT_TYPES: Partial<
	Record<EventEditorKind, LoggableEventType>
> = {
	allin: "all_in",
	chips: "chips_add_remove",
	memo: "memo",
	purchase: "purchase_chips",
};

interface UseSessionJournalOptions {
	chipPurchaseOptions: ChipPurchaseOption[];
	onMoveSeat: (playerId: string, seatPosition: number) => void;
	playerNames: ReadonlyMap<string, string>;
	seatCount: number;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
	status: SessionStatus;
}

export function useSessionJournal({
	chipPurchaseOptions,
	onMoveSeat,
	playerNames,
	seatCount,
	sessionId,
	sessionType,
	status,
}: UseSessionJournalOptions) {
	const {
		delete: deleteEvent,
		events,
		isDeletePending,
		isEventsLoading,
		isUpdatePending,
		update,
	} = useSessionEvents({
		refetchInterval: POLL_MS,
		sessionId,
		sessionType,
	});
	const { isLogPending, log } = useSessionEventLog({ sessionId, sessionType });

	const [isTimelineOpen, setIsTimelineOpen] = useState(false);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editorTarget, setEditorTarget] = useState<EventEditorTarget | null>(
		null
	);

	const rows = describeTimeline(events, { playerNames });

	const canLog = {
		allin: isEventAllowedInState("all_in", status),
		chips: isEventAllowedInState("chips_add_remove", status),
		memo: isEventAllowedInState("memo", status),
		purchase: isEventAllowedInState("purchase_chips", status),
	} satisfies Record<LoggableKind, boolean>;

	const targetEvent = editorTarget?.event ?? null;
	const lastEvent = events.at(-1);
	const bounds =
		targetEvent === null
			? {
					maxTime: null,
					minTime: lastEvent ? new Date(lastEvent.occurredAt) : null,
				}
			: getTimeBounds(events, targetEvent.id);

	const closeEditor = () => {
		setIsEditorOpen(false);
	};

	const onSelectEvent = (id: string) => {
		if (!isPersistedEventId(id)) {
			return;
		}
		const event = events.find((item) => item.id === id);
		const row = rows.find((item) => item.id === id);
		if (!(event && row)) {
			return;
		}
		setEditorTarget({
			event,
			kind: resolveEditorKind(event.eventType),
			label: row.title,
			mode: "edit",
			openedAt: new Date(),
		});
		setIsEditorOpen(true);
	};

	const onOpenNewEvent = (kind: LoggableKind) => {
		setEditorTarget({
			event: null,
			kind,
			label: NEW_EVENT_TITLES[kind],
			mode: "create",
			openedAt: new Date(),
		});
		setIsEditorOpen(true);
	};

	const onEditorSubmit = async (values: EventEditorSubmit) => {
		if (!editorTarget) {
			return;
		}
		if (editorTarget.mode === "create") {
			if (values.payload === null) {
				return;
			}
			const eventType = LOGGABLE_EVENT_TYPES[editorTarget.kind];
			if (!eventType) {
				return;
			}
			await log(eventType, {
				occurredAt: values.occurredAt,
				payload: values.payload,
			});
			closeEditor();
			return;
		}
		const event = editorTarget.event;
		if (!event) {
			return;
		}
		await update({
			id: event.id,
			occurredAt: values.occurredAt,
			payload: values.payload ?? undefined,
		});
		if (values.seatMove) {
			onMoveSeat(values.seatMove.playerId, values.seatMove.seatPosition);
		}
		closeEditor();
	};

	const onDelete =
		targetEvent === null || !isDeletableEventType(targetEvent.eventType)
			? null
			: async () => {
					await deleteEvent(targetEvent.id);
					closeEditor();
				};

	return {
		canLog,
		chipPurchaseOptions,
		editorTarget,
		events,
		isEditorOpen,
		isEditorPending: isLogPending || isUpdatePending || isDeletePending,
		isEventsLoading,
		isTimelineOpen,
		maxTime: bounds.maxTime,
		minTime: bounds.minTime,
		onCloseEditor: setIsEditorOpen,
		onCloseTimeline: setIsTimelineOpen,
		onDelete,
		onEditorSubmit,
		onOpenNewEvent,
		onOpenTimeline: () => setIsTimelineOpen(true),
		onSelectEvent,
		playerNames,
		rows,
		seatCount,
	};
}
