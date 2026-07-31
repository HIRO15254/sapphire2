import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	applyTimeToDate,
	toTimeInputValue,
} from "@/features/live-sessions/utils/stack-editor-time";
import type {
	SessionFormValues,
	TournamentFormValues,
} from "@/features/sessions/utils/session-form-helpers";

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
 * | `sessionDate` / `startTime`                  | session_start | `occurredAt`           |
 * | `endTime`                                    | session_end   | `occurredAt`           |
 * | `cashOut`                                    | session_end   | `payload.cashOutAmount`|
 * | `beforeDeadline` / `placement` / `totalEntries` / `prizeMoney` / `bountyPrizes` | session_end | `payload` |
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

const START_TIME_REQUIRED = "Start time is required for a live session";
const END_TIME_REQUIRED = "End time is required for a live session";
const INVALID_START = "Session date and start time are invalid";
const INVALID_END = "End time is invalid";
const PLACEMENT_REQUIRED = "Placement is required";
const TOTAL_ENTRIES_REQUIRED = "Total entries is required";
const PLACEMENT_RANGE = "Placement must be less than or equal to total entries";
const PRIZE_MONEY_REQUIRED = "Prize money is required";

// Aggregated over the whole event stream — never editable from the form.
const CASH_AGGREGATED_FIELDS = ["breakMinutes", "buyIn", "evCashOut"];
const TOURNAMENT_AGGREGATED_FIELDS = ["breakMinutes", "chipPurchases"];
const START_BACKED_FIELDS = ["sessionDate", "startTime"];
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
 * Local-time `yyyy-MM-dd` for a `<input type="date">`.
 *
 * Date-only columns are UTC midnight and must be read with UTC getters
 * (SA2-145, {@link formatDateForInput}), but a live session's `sessionDate` is
 * the start *timestamp* (`recalculateCashGameSession` writes `startedAt` into
 * it), and its start time is rendered with local getters. Reading the date part
 * with UTC getters would put the two halves in different days for any user off
 * UTC, so recombining them would move `session_start` on a no-op save.
 */
export function formatLocalDateForInput(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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
		isCashGame ? CASH_AGGREGATED_FIELDS : TOURNAMENT_AGGREGATED_FIELDS
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

function resolveStartOccurredAt(
	sessionStart: SessionEvent | null,
	values: SessionFormValues,
	errors: string[]
): number | null {
	if (!sessionStart) {
		return null;
	}
	if (!values.startTime) {
		errors.push(START_TIME_REQUIRED);
		return null;
	}
	const isUnchanged =
		values.sessionDate === formatLocalDateForInput(sessionStart.occurredAt) &&
		values.startTime === toTimeInputValue(sessionStart.occurredAt);
	if (isUnchanged) {
		return null;
	}
	const next = new Date(`${values.sessionDate}T${values.startTime}`);
	if (Number.isNaN(next.getTime())) {
		errors.push(INVALID_START);
		return null;
	}
	return Math.floor(next.getTime() / 1000);
}

function resolveEndOccurredAt(
	sessionEnd: SessionEvent | null,
	values: SessionFormValues,
	errors: string[]
): number | null {
	if (!sessionEnd) {
		return null;
	}
	if (!values.endTime) {
		errors.push(END_TIME_REQUIRED);
		return null;
	}
	if (values.endTime === toTimeInputValue(sessionEnd.occurredAt)) {
		return null;
	}
	// Time-only, anchored to the end event's own calendar day — the same
	// semantics as the Events-section editor. Recombining it with the form's
	// single `sessionDate` would corrupt sessions longer than a day.
	const next = applyTimeToDate(sessionEnd.occurredAt, values.endTime);
	if (Number.isNaN(next.getTime())) {
		errors.push(INVALID_END);
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

	const nextStartAt = resolveStartOccurredAt(sessionStart, values, errors);
	const nextEndAt = resolveEndOccurredAt(sessionEnd, values, errors);
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
			label: "Start time",
			seconds: nextStartAt,
		});
	}
	if (sessionEnd && nextEndAt !== null) {
		validateBounds({
			bounds: neighborBounds(events, sessionEnd.id, pending),
			errors,
			label: "End time",
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
