import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	type SessionEvent,
	useSessionEvents,
} from "@/features/live-sessions/hooks/use-session-events";
import {
	formatEventLabel,
	formatPayloadSummary,
	getTimeBounds,
} from "@/features/live-sessions/utils/session-events-formatters";
import { toTimeInputValue } from "@/features/live-sessions/utils/stack-editor-time";
import { formatNumber } from "@/utils/format-number";
import { trpc } from "@/utils/trpc";
import type { TimelineItemViewModel } from "./timeline-item";

type SessionType = "cash_game" | "tournament";

type EventColor =
	| "destructive"
	| "info"
	| "muted"
	| "primary"
	| "success"
	| "warning";

const DOT_COLOR_BY_EVENT_TYPE: Record<string, EventColor> = {
	update_stack: "success",
	all_in: "warning",
	memo: "info",
	purchase_chips: "primary",
	player_join: "muted",
	player_leave: "muted",
	session_pause: "warning",
	session_resume: "warning",
	session_start: "muted",
	session_end: "muted",
};

const DOT_CLASS_BY_COLOR: Record<EventColor, string> = {
	success: "bg-success",
	warning: "bg-warning",
	primary: "bg-primary",
	info: "bg-info",
	destructive: "bg-destructive",
	muted: "bg-muted-foreground",
};

const AMOUNT_CLASS_BY_COLOR: Record<EventColor, string> = {
	success: "text-success",
	warning: "text-warning",
	primary: "text-primary",
	info: "text-info",
	destructive: "text-destructive",
	muted: "text-muted-foreground",
};

function resolveDotColor(eventType: string, payload: unknown): EventColor {
	if (eventType === "chips_add_remove") {
		const amount =
			payload && typeof payload === "object"
				? (payload as Record<string, unknown>).amount
				: undefined;
		return typeof amount === "number" && amount < 0 ? "destructive" : "primary";
	}
	return DOT_COLOR_BY_EVENT_TYPE[eventType] ?? "muted";
}

function buildAmount(
	eventType: string,
	payload: unknown
): { amountClass: string | null; amountText: string | null } {
	if (!payload || typeof payload !== "object") {
		return { amountText: null, amountClass: null };
	}
	const p = payload as Record<string, unknown>;
	if (eventType === "chips_add_remove" && typeof p.amount === "number") {
		const isNegative = p.amount < 0;
		return {
			amountText: isNegative
				? formatNumber(p.amount)
				: `+${formatNumber(p.amount)}`,
			amountClass:
				AMOUNT_CLASS_BY_COLOR[isNegative ? "destructive" : "primary"],
		};
	}
	if (eventType === "purchase_chips" && typeof p.cost === "number") {
		return {
			amountText: `-${formatNumber(p.cost)}`,
			amountClass: AMOUNT_CLASS_BY_COLOR.primary,
		};
	}
	return { amountText: null, amountClass: null };
}

function buildSub(eventType: string, payload: unknown): string | null {
	if (eventType === "chips_add_remove") {
		return null;
	}
	if (eventType === "purchase_chips") {
		if (!payload || typeof payload !== "object") {
			return null;
		}
		const name = (payload as Record<string, unknown>).name;
		return typeof name === "string" ? name : null;
	}
	return formatPayloadSummary(eventType, payload);
}

function buildTimelineItem(
	event: SessionEvent,
	onEdit: (event: SessionEvent) => void
): TimelineItemViewModel {
	const { amountText, amountClass } = buildAmount(
		event.eventType,
		event.payload
	);
	return {
		id: event.id,
		time: toTimeInputValue(event.occurredAt),
		dotClass:
			DOT_CLASS_BY_COLOR[resolveDotColor(event.eventType, event.payload)],
		title: formatEventLabel(event.eventType),
		sub: buildSub(event.eventType, event.payload),
		amountText,
		amountClass,
		onEdit: () => onEdit(event),
	};
}

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

	const items = useMemo(
		() => events.map((event) => buildTimelineItem(event, setEditEvent)),
		[events]
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
