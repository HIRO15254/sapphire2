import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	applyTimeToDate,
	toTimeInputValue,
} from "@/features/live-sessions/utils/stack-editor-time";
import type {
	SessionFormValues,
	TournamentFormValues,
} from "@/features/sessions/utils/session-form-helpers";
import { formatLocalYmdSlash } from "@/utils/format-number";

/**
 * Sync layer between the session edit form and the live event history.
 *
 * A live-recorded session keeps every derived column (`startedAt`, `cashOut`,
 * `placement`, …) recalculated from its events, so most of the edit form is
 * read-only. The fields below are the exception: each is determined by exactly
 * one value of exactly one event, so editing the field can be expressed as an
 * edit of that event. Everything aggregated over several events (cash buy-in,
 * EV cash-out, break minutes, chip-purchase counts) stays read-only — there is
 * no single event to write it back to.
 *
 * | Form field                                   | Event         | Value                  |
 * |----------------------------------------------|---------------|------------------------|
 * | `startTime`                                  | session_start | `occurredAt` (time)    |
 * | `endTime`                                    | session_end   | `occurredAt` (time)    |
 * | `cashOut`                                    | session_end   | `payload.cashOutAmount`|
 * | `beforeDeadline` / `placement` / `totalEntries` / `prizeMoney` / `bountyPrizes` | session_end | `payload` |
 *
 * Both times are edited **within their own event's calendar day**, never
 * recombined with the form's single `sessionDate` — which is why the date input
 * itself is locked. Moving a lifecycle event to another day leaves every other
 * event where it is, so the session silently stretches (a start dragged one day
 * back turned a 5-hour session into a 29-hour one, with play time feeding the
 * statistics). Expressing that would mean moving the whole event stream, which
 * is not a single-event edit — and the Events-section editors cannot do it
 * either.
 *
 * The edits are applied through `sessionEvent.update`, which revalidates the
 * payload, enforces the neighbour-ordering rule and recalculates the session —
 * so the session columns and the events can never drift apart.
 */

export interface LiveLinkedEventEdit {
	id: string;
	occurredAt?: number;
	payload?: unknown;
}

interface OccurredAtBounds {
	max: number | null;
	min: number | null;
}

const START_TIME_LABEL = "Start time";
const END_TIME_LABEL = "End time";
const PLACEMENT_REQUIRED = "Placement is required";
const TOTAL_ENTRIES_REQUIRED = "Total entries is required";
const PLACEMENT_RANGE = "Placement must be less than or equal to total entries";
const PRIZE_MONEY_REQUIRED = "Prize money is required";

// Never editable from the form: values aggregated over the whole event stream,
// plus `sessionDate` — see the module comment on why a day cannot be moved.
const CASH_LOCKED_FIELDS = [
	"breakMinutes",
	"buyIn",
	"evCashOut",
	"sessionDate",
];
const TOURNAMENT_LOCKED_FIELDS = [
	"breakMinutes",
	"chipPurchases",
	"sessionDate",
];
const START_BACKED_FIELDS = ["startTime"];
const CASH_END_BACKED_FIELDS = ["cashOut", "endTime"];
const TOURNAMENT_END_BACKED_FIELDS = [
	"beforeDeadline",
	"bountyPrizes",
	"endTime",
	"placement",
	"prizeMoney",
	"totalEntries",
];

function secondsOf(value: string | Date): number {
	const date = typeof value === "string" ? new Date(value) : value;
	return Math.floor(date.getTime() / 1000);
}

// The server compares event times by minute (`floorToMinute` +
// `assertOccurredAtOrdering`), so the client-side bound check must too.
function minuteEpoch(seconds: number): number {
	return Math.floor(seconds / 60);
}

function timeLabel(seconds: number): string {
	return toTimeInputValue(new Date(seconds * 1000));
}

/**
 * The `session_start` / `session_end` the session's derived state comes from —
 * the first start and the last end, matching `computeSessionStateFromEvents`
 * on the server (a reopened cash session carries more than one of each).
 */
export function findLifecycleEvents(events: SessionEvent[]): {
	sessionEnd: SessionEvent | null;
	sessionStart: SessionEvent | null;
} {
	let sessionStart: SessionEvent | null = null;
	let sessionEnd: SessionEvent | null = null;
	for (const event of events) {
		if (event.eventType === "session_start" && sessionStart === null) {
			sessionStart = event;
		}
		if (event.eventType === "session_end") {
			sessionEnd = event;
		}
	}
	return { sessionEnd, sessionStart };
}

/**
 * Calendar day of the `session_end`, but only when the session crossed midnight
 * — otherwise `null`.
 *
 * The form shows a single date (the session's start day) while `endTime` is
 * edited against the end event's own day. For a 22:00 → 02:00 session those are
 * different days, and correcting "02:00" to "23:00" lands on the *end* day,
 * stretching the session to 25 hours with nothing in the UI hinting at it. The
 * End time field renders this label so the anchor day is visible.
 */
export function crossingEndDateLabel(events: SessionEvent[]): string | null {
	const { sessionEnd, sessionStart } = findLifecycleEvents(events);
	if (!(sessionEnd && sessionStart)) {
		return null;
	}
	const endLabel = formatLocalYmdSlash(sessionEnd.occurredAt);
	return endLabel === formatLocalYmdSlash(sessionStart.occurredAt)
		? null
		: endLabel;
}

/**
 * Result-step fields the edit form must keep disabled for a live session.
 * A field backed by an event that does not exist yet (no `session_end` while
 * the session is still running, or events not loaded) stays disabled too, so
 * the form never offers an edit the server would reject.
 */
export function liveLinkedDisabledResultFields({
	hasSessionEnd,
	hasSessionStart,
	type,
}: {
	hasSessionEnd: boolean;
	hasSessionStart: boolean;
	type: "cash_game" | "tournament";
}): ReadonlySet<string> {
	const isCashGame = type === "cash_game";
	const disabled = new Set(
		isCashGame ? CASH_LOCKED_FIELDS : TOURNAMENT_LOCKED_FIELDS
	);
	if (!hasSessionStart) {
		for (const field of START_BACKED_FIELDS) {
			disabled.add(field);
		}
	}
	if (!hasSessionEnd) {
		for (const field of isCashGame
			? CASH_END_BACKED_FIELDS
			: TOURNAMENT_END_BACKED_FIELDS) {
			disabled.add(field);
		}
	}
	return disabled;
}

/**
 * New `occurredAt` for a lifecycle event, or `null` when the clock time is
 * unchanged (or the event does not exist). The edit is time-only, anchored to
 * the event's own calendar day — the same semantics as the Events-section
 * editors, and the reason a session spanning more than a day survives an edit.
 */
function resolveLifecycleOccurredAt({
	errors,
	event,
	label,
	time,
}: {
	errors: string[];
	event: SessionEvent | null;
	label: string;
	time: string | undefined;
}): number | null {
	if (!event) {
		return null;
	}
	if (!time) {
		errors.push(`${label} is required for a live session`);
		return null;
	}
	if (time === toTimeInputValue(event.occurredAt)) {
		return null;
	}
	const next = applyTimeToDate(event.occurredAt, time);
	if (Number.isNaN(next.getTime())) {
		errors.push(`${label} is invalid`);
		return null;
	}
	return Math.floor(next.getTime() / 1000);
}

function buildTournamentEndPayload(
	values: TournamentFormValues,
	errors: string[]
): Record<string, unknown> | null {
	if (values.prizeMoney === undefined) {
		// A blank must not be saved as 0 — that silently corrupts P/L (SA2-113).
		errors.push(PRIZE_MONEY_REQUIRED);
		return null;
	}
	const common = {
		prizeMoney: values.prizeMoney,
		bountyPrizes: values.bountyPrizes ?? 0,
	};
	if (values.beforeDeadline === true) {
		return { beforeDeadline: true, ...common };
	}
	if (values.placement === undefined) {
		errors.push(PLACEMENT_REQUIRED);
		return null;
	}
	if (values.totalEntries === undefined) {
		errors.push(TOTAL_ENTRIES_REQUIRED);
		return null;
	}
	if (values.placement > values.totalEntries) {
		errors.push(PLACEMENT_RANGE);
		return null;
	}
	return {
		beforeDeadline: false,
		placement: values.placement,
		totalEntries: values.totalEntries,
		...common,
	};
}

function buildSessionEndPayload(
	values: SessionFormValues,
	errors: string[]
): Record<string, unknown> | null {
	return values.type === "cash_game"
		? { cashOutAmount: values.cashOut }
		: buildTournamentEndPayload(values, errors);
}

// `sessionEvent.update` replaces the payload wholesale, so an unchanged payload
// is simply not sent. Both shapes are flat records of primitives.
function isSamePayload(
	current: unknown,
	next: Record<string, unknown>
): boolean {
	if (!current || typeof current !== "object") {
		return false;
	}
	const currentRecord = current as Record<string, unknown>;
	const nextKeys = Object.keys(next);
	if (Object.keys(currentRecord).length !== nextKeys.length) {
		return false;
	}
	return nextKeys.every((key) => currentRecord[key] === next[key]);
}

/**
 * Bounds an event's new time must respect, reading the neighbours by position
 * and substituting the other lifecycle event's *pending* time when it is the
 * neighbour — otherwise moving start and end together would be rejected
 * against a time that is about to change.
 */
function neighborBounds(
	events: SessionEvent[],
	targetId: string,
	pending: Map<string, number>
): OccurredAtBounds {
	const index = events.findIndex((event) => event.id === targetId);
	if (index < 0) {
		return { max: null, min: null };
	}
	const previous = index > 0 ? events[index - 1] : undefined;
	const next = index < events.length - 1 ? events[index + 1] : undefined;
	const effectiveAt = (event: SessionEvent) =>
		pending.get(event.id) ?? secondsOf(event.occurredAt);
	return {
		max: next ? effectiveAt(next) : null,
		min: previous ? effectiveAt(previous) : null,
	};
}

function validateBounds({
	bounds,
	errors,
	label,
	seconds,
}: {
	bounds: OccurredAtBounds;
	errors: string[];
	label: string;
	seconds: number;
}): void {
	const target = minuteEpoch(seconds);
	if (bounds.min !== null && target < minuteEpoch(bounds.min)) {
		errors.push(
			`${label} must not be before the previous event (${timeLabel(bounds.min)})`
		);
		return;
	}
	if (bounds.max !== null && target > minuteEpoch(bounds.max)) {
		errors.push(
			`${label} must not be after the next event (${timeLabel(bounds.max)})`
		);
	}
}

function buildEndEdit({
	occurredAt,
	payload,
	sessionEnd,
}: {
	occurredAt: number | null;
	payload: Record<string, unknown> | null;
	sessionEnd: SessionEvent;
}): LiveLinkedEventEdit | null {
	const changedPayload =
		payload && !isSamePayload(sessionEnd.payload, payload) ? payload : null;
	if (occurredAt === null && changedPayload === null) {
		return null;
	}
	return {
		id: sessionEnd.id,
		...(occurredAt === null ? {} : { occurredAt }),
		...(changedPayload === null ? {} : { payload: changedPayload }),
	};
}

/**
 * Translates a submitted edit form into the `sessionEvent.update` calls that
 * carry it back into the event history, plus the validation errors that must
 * abort the submit before anything is written.
 *
 * The edits are returned in the order they must be applied: when the end moves
 * later it goes first, so a start moving past the end's *old* time is never
 * rejected by the server's neighbour check (and vice versa).
 */
export function buildLiveLinkedEventEdits({
	events,
	values,
}: {
	events: SessionEvent[];
	values: SessionFormValues;
}): { edits: LiveLinkedEventEdit[]; errors: string[] } {
	const errors: string[] = [];
	const { sessionEnd, sessionStart } = findLifecycleEvents(events);

	const nextStartAt = resolveLifecycleOccurredAt({
		errors,
		event: sessionStart,
		label: START_TIME_LABEL,
		time: values.startTime,
	});
	const nextEndAt = resolveLifecycleOccurredAt({
		errors,
		event: sessionEnd,
		label: END_TIME_LABEL,
		time: values.endTime,
	});
	const payload = sessionEnd ? buildSessionEndPayload(values, errors) : null;

	const pending = new Map<string, number>();
	if (sessionStart && nextStartAt !== null) {
		pending.set(sessionStart.id, nextStartAt);
	}
	if (sessionEnd && nextEndAt !== null) {
		pending.set(sessionEnd.id, nextEndAt);
	}
	if (sessionStart && nextStartAt !== null) {
		validateBounds({
			bounds: neighborBounds(events, sessionStart.id, pending),
			errors,
			label: START_TIME_LABEL,
			seconds: nextStartAt,
		});
	}
	if (sessionEnd && nextEndAt !== null) {
		validateBounds({
			bounds: neighborBounds(events, sessionEnd.id, pending),
			errors,
			label: END_TIME_LABEL,
			seconds: nextEndAt,
		});
	}

	if (errors.length > 0) {
		return { edits: [], errors };
	}

	const startEdit =
		sessionStart && nextStartAt !== null
			? { id: sessionStart.id, occurredAt: nextStartAt }
			: null;
	const endEdit = sessionEnd
		? buildEndEdit({ occurredAt: nextEndAt, payload, sessionEnd })
		: null;
	const endMovesLater =
		sessionEnd !== null &&
		nextEndAt !== null &&
		nextEndAt > secondsOf(sessionEnd.occurredAt);
	const ordered = endMovesLater ? [endEdit, startEdit] : [startEdit, endEdit];

	return { edits: ordered.filter((edit) => edit !== null), errors };
}
