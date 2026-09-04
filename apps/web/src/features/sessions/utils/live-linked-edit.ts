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
const BOUNTY_PRIZES_REQUIRED = "Bounty prizes is required";

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
const TOURNAMENT_END_REQUIRED_FIELDS = [
	"bountyPrizes",
	"placement",
	"prizeMoney",
	"totalEntries",
];
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

function minuteEpoch(seconds: number): number {
	return Math.floor(seconds / 60);
}

function timeLabel(seconds: number): string {
	return toTimeInputValue(new Date(seconds * 1000));
}

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

export function lifecycleDayHints({
	displayedDate,
	events,
}: {
	displayedDate: string;
	events: SessionEvent[];
}): { end: string | null; start: string | null } {
	if (!displayedDate) {
		return { end: null, start: null };
	}
	const shownDay = displayedDate.replaceAll("-", "/");
	const { sessionEnd, sessionStart } = findLifecycleEvents(events);
	const hintFor = (event: SessionEvent | null) => {
		if (!event) {
			return null;
		}
		const day = formatLocalYmdSlash(event.occurredAt);
		return day === shownDay ? null : day;
	};
	return { end: hintFor(sessionEnd), start: hintFor(sessionStart) };
}

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

export function liveLinkedRequiredResultFields({
	hasSessionEnd,
	hasSessionStart,
	type,
}: {
	hasSessionEnd: boolean;
	hasSessionStart: boolean;
	type: "cash_game" | "tournament";
}): ReadonlySet<string> {
	const required = new Set<string>();
	if (hasSessionStart) {
		required.add("startTime");
	}
	if (hasSessionEnd) {
		required.add("endTime");
		if (type === "tournament") {
			for (const field of TOURNAMENT_END_REQUIRED_FIELDS) {
				required.add(field);
			}
		}
	}
	return required;
}

function resolveLifecycleOccurredAt({
	current,
	errors,
	label,
	seed,
	time,
}: {
	current: SessionEvent | null;
	errors: string[];
	label: string;
	seed: SessionEvent | null;
	time: string | undefined;
}): number | null {
	if (!current) {
		return null;
	}
	if (!time) {
		errors.push(`${label} is required for a live session`);
		return null;
	}
	if (time === toTimeInputValue((seed ?? current).occurredAt)) {
		return null;
	}
	const next = applyTimeToDate(current.occurredAt, time);
	if (Number.isNaN(next.getTime())) {
		errors.push(`${label} is invalid`);
		return null;
	}
	const seconds = Math.floor(next.getTime() / 1000);
	return minuteEpoch(seconds) === minuteEpoch(secondsOf(current.occurredAt))
		? null
		: seconds;
}

function numberAt(payload: unknown, key: string): number | undefined {
	if (!payload || typeof payload !== "object") {
		return undefined;
	}
	const value = (payload as Record<string, unknown>)[key];
	return typeof value === "number" ? value : undefined;
}

function isBeforeDeadline(payload: unknown): boolean {
	return (
		!!payload &&
		typeof payload === "object" &&
		(payload as Record<string, unknown>).beforeDeadline === true
	);
}

function keepUnlessEdited<T>(formValue: T, seedValue: T, currentValue: T): T {
	return formValue === seedValue ? currentValue : formValue;
}

interface TournamentResult {
	beforeDeadline: boolean;
	bountyPrizes: number | undefined;
	placement: number | undefined;
	prizeMoney: number | undefined;
	totalEntries: number | undefined;
}

function mergeTournamentResult({
	current,
	seed,
	values,
}: {
	current: SessionEvent;
	seed: SessionEvent | null;
	values: TournamentFormValues;
}): TournamentResult {
	const seedPayload = (seed ?? current).payload;
	const currentPayload = current.payload;
	const numeric = (key: keyof TournamentResult & string, formValue?: number) =>
		keepUnlessEdited(
			formValue,
			numberAt(seedPayload, key),
			numberAt(currentPayload, key)
		);
	return {
		beforeDeadline: keepUnlessEdited(
			values.beforeDeadline === true,
			isBeforeDeadline(seedPayload),
			isBeforeDeadline(currentPayload)
		),
		bountyPrizes:
			(values.bountyPrizes ?? 0) ===
			(numberAt(seedPayload, "bountyPrizes") ?? 0)
				? (numberAt(currentPayload, "bountyPrizes") ?? 0)
				: values.bountyPrizes,
		placement: numeric("placement", values.placement),
		prizeMoney: numeric("prizeMoney", values.prizeMoney),
		totalEntries: numeric("totalEntries", values.totalEntries),
	};
}

function buildTournamentEndPayload(
	values: TournamentResult,
	errors: string[]
): Record<string, unknown> | null {
	if (values.prizeMoney === undefined) {
		errors.push(PRIZE_MONEY_REQUIRED);
		return null;
	}
	if (values.bountyPrizes === undefined) {
		errors.push(BOUNTY_PRIZES_REQUIRED);
		return null;
	}
	const common = {
		prizeMoney: values.prizeMoney,
		bountyPrizes: values.bountyPrizes,
	};
	if (values.beforeDeadline) {
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

function buildSessionEndPayload({
	current,
	errors,
	seed,
	values,
}: {
	current: SessionEvent;
	errors: string[];
	seed: SessionEvent | null;
	values: SessionFormValues;
}): Record<string, unknown> | null {
	if (values.type !== "cash_game") {
		return buildTournamentEndPayload(
			mergeTournamentResult({ current, seed, values }),
			errors
		);
	}
	const cashOutAmount = keepUnlessEdited(
		values.cashOut,
		numberAt((seed ?? current).payload, "cashOutAmount"),
		numberAt(current.payload, "cashOutAmount")
	);
	return { cashOutAmount: cashOutAmount ?? values.cashOut };
}

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

function neighborBounds(
	events: SessionEvent[],
	targetId: string,
	pending: Map<string, number>
): OccurredAtBounds {
	const index = events.findIndex((event) => event.id === targetId);
	// Stryker disable next-line BlockStatement: equivalent: neighborBounds is only called with an id already found in the same events array
	if (index < 0) {
		// Stryker disable next-line ObjectLiteral: equivalent: neighborBounds is only called with an id already found in the same events array
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

export function buildLiveLinkedEventEdits({
	events,
	seedEvents,
	values,
}: {
	events: SessionEvent[];
	seedEvents?: SessionEvent[];
	values: SessionFormValues;
}): { edits: LiveLinkedEventEdit[]; errors: string[] } {
	const errors: string[] = [];
	const { sessionEnd, sessionStart } = findLifecycleEvents(events);
	const seed = findLifecycleEvents(seedEvents ?? events);

	const nextStartAt = resolveLifecycleOccurredAt({
		current: sessionStart,
		errors,
		label: START_TIME_LABEL,
		seed: seed.sessionStart,
		time: values.startTime,
	});
	const nextEndAt = resolveLifecycleOccurredAt({
		current: sessionEnd,
		errors,
		label: END_TIME_LABEL,
		seed: seed.sessionEnd,
		time: values.endTime,
	});
	const payload = sessionEnd
		? buildSessionEndPayload({
				current: sessionEnd,
				errors,
				seed: seed.sessionEnd,
				values,
			})
		: null;

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
