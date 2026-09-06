import { LIFECYCLE_EVENT_TYPES } from "@sapphire2/db/constants/session-event-types";
import {
	formatLocalHm,
	formatNumber,
	formatSignedNumber,
} from "@/utils/format-number";
import { computeAllInEv } from "./live-session-summary";

export type EventEditorKind =
	| "allin"
	| "chips"
	| "end"
	| "memo"
	| "purchase"
	| "seat"
	| "stack"
	| "start"
	| "time";

export type TimelineTone =
	| "destructive"
	| "info"
	| "muted"
	| "primary"
	| "success"
	| "warning";

export interface TimelineEventLike {
	eventType: string;
	id: string;
	occurredAt: Date | string;
	payload: unknown;
}

export interface TimelineRow {
	amount: string | null;
	editorKind: EventEditorKind;
	eventType: string;
	hasLineAbove: boolean;
	hasLineBelow: boolean;
	id: string;
	isDeletable: boolean;
	sub: string | null;
	time: string;
	title: string;
	tone: TimelineTone;
}

interface TimelineContext {
	playerNames: ReadonlyMap<string, string>;
}

interface RowContent {
	amount: string | null;
	sub: string | null;
	title: string;
	tone: TimelineTone;
}

const EDITOR_KINDS: Record<string, EventEditorKind> = {
	all_in: "allin",
	chips_add_remove: "chips",
	memo: "memo",
	player_join: "seat",
	player_leave: "seat",
	purchase_chips: "purchase",
	session_end: "end",
	session_pause: "time",
	session_resume: "time",
	session_start: "start",
	update_stack: "stack",
};

const MS_PER_SECOND = 1000;

export function isDeletableEventType(eventType: string): boolean {
	return !(LIFECYCLE_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function resolveEditorKind(eventType: string): EventEditorKind {
	return EDITOR_KINDS[eventType] ?? "time";
}

function toPayload(payload: unknown): Record<string, unknown> {
	return payload && typeof payload === "object"
		? (payload as Record<string, unknown>)
		: {};
}

function readNumber(payload: Record<string, unknown>, key: string) {
	const value = payload[key];
	return typeof value === "number" ? value : null;
}

function readString(payload: Record<string, unknown>, key: string) {
	const value = payload[key];
	return typeof value === "string" ? value : null;
}

function joinParts(parts: (string | null)[]): string | null {
	const kept = parts.filter((part): part is string => part !== null);
	return kept.length === 0 ? null : kept.join(" · ");
}

function describePurchaseCounts(payload: Record<string, unknown>) {
	const counts = payload.chipPurchaseCounts;
	if (!Array.isArray(counts)) {
		return null;
	}
	const labels: string[] = [];
	for (const entry of counts) {
		const item = toPayload(entry);
		const name = readString(item, "name");
		const count = readNumber(item, "count");
		if (name !== null && count !== null && count > 0) {
			labels.push(`${name} ×${count}`);
		}
	}
	return labels.length === 0 ? null : `purchases: ${labels.join(", ")}`;
}

function describeUpdateStack(payload: Record<string, unknown>): RowContent {
	const stackAmount = readNumber(payload, "stackAmount");
	const remaining = readNumber(payload, "remainingPlayers");
	const total = readNumber(payload, "totalEntries");
	const hasCounts = remaining !== null || total !== null;
	return {
		amount: stackAmount === null ? null : formatNumber(stackAmount),
		sub: joinParts([
			hasCounts ? `${remaining ?? "—"} / ${total ?? "—"} left` : null,
			describePurchaseCounts(payload),
		]),
		title: "Stack update",
		tone: "success",
	};
}

function describeAllIn(payload: Record<string, unknown>): RowContent {
	const potSize = readNumber(payload, "potSize");
	const equity = readNumber(payload, "equity");
	const trials = readNumber(payload, "trials");
	const wins = readNumber(payload, "wins");
	const hasEv =
		potSize !== null && equity !== null && trials !== null && wins !== null;
	const evDelta = hasEv
		? computeAllInEv({ equity, potSize, trials, wins }).evDelta
		: null;
	return {
		amount: null,
		sub: joinParts([
			potSize === null ? null : `Pot ${formatNumber(potSize)}`,
			equity === null ? null : `Eq ${equity}%`,
			trials === null || wins === null ? null : `${wins} of ${trials} won`,
			evDelta === null
				? null
				: `EV delta ${formatSignedNumber(Math.round(evDelta))}`,
		]),
		title: "All-in",
		tone: "warning",
	};
}

function describeChips(payload: Record<string, unknown>): RowContent {
	const amount = readNumber(payload, "amount");
	const isRemoval = amount !== null && amount < 0;
	return {
		amount: amount === null ? null : formatSignedNumber(amount),
		sub: null,
		title: isRemoval ? "Chip withdrawal" : "Chip add",
		tone: isRemoval ? "destructive" : "primary",
	};
}

function describePurchase(payload: Record<string, unknown>): RowContent {
	const name = readString(payload, "name");
	const cost = readNumber(payload, "cost");
	const chips = readNumber(payload, "chips");
	return {
		amount: null,
		sub: joinParts([
			cost === null ? null : `Cost ${formatNumber(cost)}`,
			chips === null ? null : `${formatSignedNumber(chips)} chips`,
		]),
		title: name === null ? "Chip purchase" : `Chip purchase — ${name}`,
		tone: "primary",
	};
}

function describeMemo(payload: Record<string, unknown>): RowContent {
	const text = readString(payload, "text")?.trim();
	return {
		amount: null,
		sub: null,
		title: text ? `Note — ${text}` : "Note",
		tone: "info",
	};
}

function describeSeatName(
	payload: Record<string, unknown>,
	context: TimelineContext
): string {
	if (payload.isHero === true) {
		return "You";
	}
	const playerId = readString(payload, "playerId");
	return (
		(playerId === null ? null : context.playerNames.get(playerId)) ?? "Player"
	);
}

function describePlayerJoin(
	payload: Record<string, unknown>,
	context: TimelineContext
): RowContent {
	const seatPosition = readNumber(payload, "seatPosition");
	const seat = seatPosition === null ? "" : ` at S${seatPosition + 1}`;
	return {
		amount: null,
		sub: null,
		title: `${describeSeatName(payload, context)} seated${seat}`,
		tone: "muted",
	};
}

function describePlayerLeave(
	payload: Record<string, unknown>,
	context: TimelineContext
): RowContent {
	return {
		amount: null,
		sub: null,
		title: `${describeSeatName(payload, context)} left the table`,
		tone: "muted",
	};
}

function describeSessionStart(payload: Record<string, unknown>): RowContent {
	const buyInAmount = readNumber(payload, "buyInAmount");
	const timerStartedAt = readNumber(payload, "timerStartedAt");
	let sub: string | null = null;
	if (buyInAmount !== null) {
		sub = `Buy-in ${formatNumber(buyInAmount)}`;
	} else if (timerStartedAt !== null) {
		sub = `Timer start ${formatLocalHm(new Date(timerStartedAt * MS_PER_SECOND))}`;
	}
	return { amount: null, sub, title: "Session start", tone: "muted" };
}

function describeContent(
	event: TimelineEventLike,
	context: TimelineContext
): RowContent {
	const payload = toPayload(event.payload);
	switch (event.eventType) {
		case "update_stack":
			return describeUpdateStack(payload);
		case "all_in":
			return describeAllIn(payload);
		case "chips_add_remove":
			return describeChips(payload);
		case "purchase_chips":
			return describePurchase(payload);
		case "memo":
			return describeMemo(payload);
		case "player_join":
			return describePlayerJoin(payload, context);
		case "player_leave":
			return describePlayerLeave(payload, context);
		case "session_pause":
			return { amount: null, sub: null, title: "Pause", tone: "warning" };
		case "session_resume":
			return { amount: null, sub: null, title: "Resume", tone: "warning" };
		case "session_start":
			return describeSessionStart(payload);
		case "session_end":
			return { amount: null, sub: null, title: "Session end", tone: "muted" };
		default:
			return {
				amount: null,
				sub: null,
				title: event.eventType,
				tone: "muted",
			};
	}
}

function computePausedAfter(events: readonly TimelineEventLike[]): boolean[] {
	const flags: boolean[] = [];
	let isPaused = false;
	for (const event of events) {
		if (event.eventType === "session_pause") {
			isPaused = true;
		} else if (event.eventType === "session_resume") {
			isPaused = false;
		}
		flags.push(isPaused);
	}
	return flags;
}

export function describeTimeline(
	events: readonly TimelineEventLike[],
	context: TimelineContext
): TimelineRow[] {
	const pausedAfter = computePausedAfter(events);
	const rows: TimelineRow[] = [];
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (!event) {
			continue;
		}
		rows.push({
			...describeContent(event, context),
			editorKind: resolveEditorKind(event.eventType),
			eventType: event.eventType,
			hasLineAbove: i < events.length - 1 && !pausedAfter[i],
			hasLineBelow: i > 0 && !pausedAfter[i - 1],
			id: event.id,
			isDeletable: isDeletableEventType(event.eventType),
			time: formatLocalHm(event.occurredAt),
		});
	}
	return rows;
}
