import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	buildLiveLinkedEventEdits,
	crossingEndDateLabel,
	findLifecycleEvents,
	liveLinkedDisabledResultFields,
} from "@/features/sessions/utils/live-linked-edit";
import type { SessionFormValues } from "@/features/sessions/utils/session-form-helpers";

// Events are built from local-time components so the local-time round trip the
// form performs (date input + time input → timestamp) holds in any TZ.
function localIso(
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number,
	seconds = 0
): string {
	return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
}

function unix(
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number
): number {
	return Math.floor(
		new Date(year, month - 1, day, hours, minutes).getTime() / 1000
	);
}

function event(
	id: string,
	eventType: string,
	occurredAt: string,
	payload: unknown = {}
): SessionEvent {
	return { id, eventType, occurredAt, payload };
}

const CASH_START = event(
	"e-start",
	"session_start",
	localIso(2026, 4, 10, 20, 0),
	{
		buyInAmount: 10_000,
	}
);
const CASH_CHIPS = event(
	"e-chips",
	"chips_add_remove",
	localIso(2026, 4, 10, 21, 0),
	{
		amount: 5000,
	}
);
const CASH_END = event("e-end", "session_end", localIso(2026, 4, 11, 1, 0), {
	cashOutAmount: 11_500,
});
const CASH_EVENTS = [CASH_START, CASH_CHIPS, CASH_END];

const CASH_VALUES: SessionFormValues = {
	type: "cash_game",
	sessionDate: "2026-04-10",
	startTime: "20:00",
	endTime: "01:00",
	buyIn: 10_000,
	cashOut: 11_500,
	variant: "No Limit Hold'em",
};

const TOURNAMENT_START = event(
	"t-start",
	"session_start",
	localIso(2026, 4, 10, 18, 0),
	{ timerStartedAt: null }
);
const TOURNAMENT_STACK = event(
	"t-stack",
	"update_stack",
	localIso(2026, 4, 10, 20, 0),
	{ stackAmount: 42_000 }
);
const TOURNAMENT_END = event(
	"t-end",
	"session_end",
	localIso(2026, 4, 10, 23, 0),
	{
		beforeDeadline: false,
		placement: 3,
		totalEntries: 50,
		prizeMoney: 20_000,
		bountyPrizes: 0,
	}
);
const TOURNAMENT_EVENTS = [TOURNAMENT_START, TOURNAMENT_STACK, TOURNAMENT_END];

const TOURNAMENT_VALUES: SessionFormValues = {
	type: "tournament",
	sessionDate: "2026-04-10",
	startTime: "18:00",
	endTime: "23:00",
	tournamentBuyIn: 10_000,
	beforeDeadline: false,
	placement: 3,
	totalEntries: 50,
	prizeMoney: 20_000,
	bountyPrizes: 0,
};

describe("findLifecycleEvents", () => {
	it("returns the session_start and session_end of a completed session", () => {
		const { sessionStart, sessionEnd } = findLifecycleEvents(CASH_EVENTS);
		expect(sessionStart?.id).toBe("e-start");
		expect(sessionEnd?.id).toBe("e-end");
	});

	it("returns null for both when the event list is empty", () => {
		const { sessionStart, sessionEnd } = findLifecycleEvents([]);
		expect(sessionStart).toBeNull();
		expect(sessionEnd).toBeNull();
	});

	it("returns a null session_end while the session is still running", () => {
		const { sessionStart, sessionEnd } = findLifecycleEvents([
			CASH_START,
			CASH_CHIPS,
		]);
		expect(sessionStart?.id).toBe("e-start");
		expect(sessionEnd).toBeNull();
	});

	it("picks the first session_start and the last session_end of a reopened session", () => {
		const reopened = [
			CASH_START,
			event("e-end-1", "session_end", localIso(2026, 4, 10, 23, 0), {
				cashOutAmount: 9000,
			}),
			event("e-start-2", "session_start", localIso(2026, 4, 11, 0, 0), {
				buyInAmount: 5000,
			}),
			CASH_END,
		];
		const { sessionStart, sessionEnd } = findLifecycleEvents(reopened);
		expect(sessionStart?.id).toBe("e-start");
		expect(sessionEnd?.id).toBe("e-end");
	});
});

// The form shows one date (the session's start day) but the end time is edited
// against the end event's own day. When they differ the user has to be told,
// otherwise "fix 02:00 to 23:00" silently produces a 25-hour session.
describe("crossingEndDateLabel", () => {
	it("labels the end day when the session crossed midnight", () => {
		expect(crossingEndDateLabel(CASH_EVENTS)).toBe("2026/04/11");
	});

	it("returns null when start and end share a calendar day", () => {
		expect(crossingEndDateLabel(TOURNAMENT_EVENTS)).toBeNull();
	});

	it("returns null while the session has not ended", () => {
		expect(crossingEndDateLabel([CASH_START, CASH_CHIPS])).toBeNull();
	});

	it("returns null when there is no session_start to compare against", () => {
		expect(crossingEndDateLabel([CASH_END])).toBeNull();
	});

	it("returns null for an empty event list", () => {
		expect(crossingEndDateLabel([])).toBeNull();
	});
});

describe("liveLinkedDisabledResultFields", () => {
	it("leaves the single-event-backed cash fields editable for a completed session", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "cash_game",
			hasSessionStart: true,
			hasSessionEnd: true,
		});
		expect([...disabled].sort()).toEqual([
			"breakMinutes",
			"buyIn",
			"evCashOut",
			"sessionDate",
		]);
	});

	it("locks the session date even for a completed session", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "cash_game",
			hasSessionStart: true,
			hasSessionEnd: true,
		});
		expect(disabled.has("sessionDate")).toBe(true);
		expect(disabled.has("startTime")).toBe(false);
	});

	it("disables the end-backed cash fields while the session has no session_end", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "cash_game",
			hasSessionStart: true,
			hasSessionEnd: false,
		});
		expect(disabled.has("cashOut")).toBe(true);
		expect(disabled.has("endTime")).toBe(true);
		expect(disabled.has("startTime")).toBe(false);
	});

	it("disables the start time when no session_start is loaded", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "cash_game",
			hasSessionStart: false,
			hasSessionEnd: true,
		});
		expect(disabled.has("startTime")).toBe(true);
		expect(disabled.has("cashOut")).toBe(false);
	});

	it("leaves the single-event-backed tournament result fields editable", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "tournament",
			hasSessionStart: true,
			hasSessionEnd: true,
		});
		expect([...disabled].sort()).toEqual([
			"breakMinutes",
			"chipPurchases",
			"sessionDate",
		]);
	});

	it("disables every tournament result field while the session has no session_end", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "tournament",
			hasSessionStart: true,
			hasSessionEnd: false,
		});
		for (const field of [
			"endTime",
			"beforeDeadline",
			"placement",
			"totalEntries",
			"prizeMoney",
			"bountyPrizes",
		]) {
			expect(disabled.has(field)).toBe(true);
		}
	});

	it("disables every result field when no lifecycle event is available yet", () => {
		const disabled = liveLinkedDisabledResultFields({
			type: "cash_game",
			hasSessionStart: false,
			hasSessionEnd: false,
		});
		for (const field of [
			"sessionDate",
			"startTime",
			"endTime",
			"breakMinutes",
			"buyIn",
			"cashOut",
			"evCashOut",
		]) {
			expect(disabled.has(field)).toBe(true);
		}
	});
});

describe("buildLiveLinkedEventEdits — cash game", () => {
	it("emits no edit when nothing changed", () => {
		const result = buildLiveLinkedEventEdits({
			values: CASH_VALUES,
			events: CASH_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([]);
	});

	it("treats a seconds-carrying event time as unchanged against its minute string", () => {
		const events = [
			event("e-start", "session_start", localIso(2026, 4, 10, 20, 0, 45), {
				buyInAmount: 10_000,
			}),
			CASH_CHIPS,
			CASH_END,
		];
		const result = buildLiveLinkedEventEdits({
			values: CASH_VALUES,
			events,
		});
		expect(result.edits).toEqual([]);
	});

	it("syncs a cash-out change to the session_end payload only", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, cashOut: 12_000 },
			events: CASH_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([
			{ id: "e-end", payload: { cashOutAmount: 12_000 } },
		]);
	});

	it("ignores the aggregated buy-in even when the submitted value differs", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, buyIn: 99_999 },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([]);
	});

	it("syncs a start-time change to the session_start occurredAt", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, startTime: "19:00" },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([
			{ id: "e-start", occurredAt: unix(2026, 4, 10, 19, 0) },
		]);
	});

	// Moving the calendar day cannot be expressed as a single-event edit: the
	// other events stay where they are, so the session would silently stretch
	// (start 04-10 20:00 / end 04-11 01:00 → 29 hours). The field is locked, and
	// a stale submitted value must never move the event.
	it("ignores a session-date change", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, sessionDate: "2026-04-09" },
			events: CASH_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([]);
	});

	it("keeps a start-time edit on the start event's own day when the date differs", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, sessionDate: "2026-04-09", startTime: "19:00" },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([
			{ id: "e-start", occurredAt: unix(2026, 4, 10, 19, 0) },
		]);
	});

	it("applies an end-time change to the session_end's own calendar day", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, endTime: "02:30" },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([
			{ id: "e-end", occurredAt: unix(2026, 4, 11, 2, 30) },
		]);
	});

	it("combines an end-time and a cash-out change into one session_end edit", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, endTime: "02:30", cashOut: 12_000 },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([
			{
				id: "e-end",
				occurredAt: unix(2026, 4, 11, 2, 30),
				payload: { cashOutAmount: 12_000 },
			},
		]);
	});

	it("rejects a start time that would follow the next event", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, startTime: "21:30" },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual([
			"Start time must not be after the next event (21:00)",
		]);
	});

	it("accepts a start time exactly on the next event's minute", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, startTime: "21:00" },
			events: CASH_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([
			{ id: "e-start", occurredAt: unix(2026, 4, 10, 21, 0) },
		]);
	});

	it("rejects an end time that would precede the previous event", () => {
		// Same-day session: the end event shares its calendar day with the
		// chips event, so a time-only edit can land before it.
		const sameDayEnd = event(
			"e-end",
			"session_end",
			localIso(2026, 4, 10, 23, 0),
			{ cashOutAmount: 11_500 }
		);
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, endTime: "20:30" },
			events: [CASH_START, CASH_CHIPS, sameDayEnd],
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual([
			"End time must not be before the previous event (21:00)",
		]);
	});

	it("reports a missing start time instead of moving the event", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, startTime: undefined },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual([
			"Start time is required for a live session",
		]);
	});

	it("reports a missing end time when the session has a session_end", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, endTime: undefined },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual(["End time is required for a live session"]);
	});

	it("emits no end edits for a session that has not ended", () => {
		const result = buildLiveLinkedEventEdits({
			values: {
				...CASH_VALUES,
				endTime: undefined,
				cashOut: 12_000,
			},
			events: [CASH_START, CASH_CHIPS],
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([]);
	});

	it("emits nothing for an empty event list", () => {
		const result = buildLiveLinkedEventEdits({
			values: CASH_VALUES,
			events: [],
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([]);
	});

	it("rejects an unparseable start time", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, startTime: "ab:cd" },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual(["Start time is invalid"]);
	});

	it("rejects an unparseable end time", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...CASH_VALUES, endTime: "ab:cd" },
			events: CASH_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual(["End time is invalid"]);
	});
});

describe("buildLiveLinkedEventEdits — edit ordering", () => {
	const ADJACENT = [
		event("a-start", "session_start", localIso(2026, 4, 10, 20, 0), {
			buyInAmount: 10_000,
		}),
		event("a-end", "session_end", localIso(2026, 4, 10, 21, 0), {
			cashOutAmount: 11_500,
		}),
	];
	const ADJACENT_VALUES: SessionFormValues = {
		...CASH_VALUES,
		startTime: "20:00",
		endTime: "21:00",
	};

	it("applies the end edit first when the end moves later", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...ADJACENT_VALUES, startTime: "22:00", endTime: "23:00" },
			events: ADJACENT,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([
			{ id: "a-end", occurredAt: unix(2026, 4, 10, 23, 0) },
			{ id: "a-start", occurredAt: unix(2026, 4, 10, 22, 0) },
		]);
	});

	it("applies the start edit first when the end moves earlier", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...ADJACENT_VALUES, startTime: "18:00", endTime: "19:00" },
			events: ADJACENT,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([
			{ id: "a-start", occurredAt: unix(2026, 4, 10, 18, 0) },
			{ id: "a-end", occurredAt: unix(2026, 4, 10, 19, 0) },
		]);
	});

	it("validates the moved start against the moved end, not the stored one", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...ADJACENT_VALUES, startTime: "22:30", endTime: "23:00" },
			events: ADJACENT,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toHaveLength(2);
	});

	it("reports both sides when the moved start would pass the moved end", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...ADJACENT_VALUES, startTime: "23:30", endTime: "23:00" },
			events: ADJACENT,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual([
			"Start time must not be after the next event (23:00)",
			"End time must not be before the previous event (23:30)",
		]);
	});
});

describe("buildLiveLinkedEventEdits — tournament", () => {
	it("emits no edit when nothing changed", () => {
		const result = buildLiveLinkedEventEdits({
			values: TOURNAMENT_VALUES,
			events: TOURNAMENT_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([]);
	});

	it("sends the full result payload when the placement changes", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, placement: 1 },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([
			{
				id: "t-end",
				payload: {
					beforeDeadline: false,
					placement: 1,
					totalEntries: 50,
					prizeMoney: 20_000,
					bountyPrizes: 0,
				},
			},
		]);
	});

	it("drops placement and total entries when beforeDeadline is toggled on", () => {
		const result = buildLiveLinkedEventEdits({
			values: {
				...TOURNAMENT_VALUES,
				beforeDeadline: true,
				placement: undefined,
				totalEntries: undefined,
			},
			events: TOURNAMENT_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toEqual([
			{
				id: "t-end",
				payload: {
					beforeDeadline: true,
					prizeMoney: 20_000,
					bountyPrizes: 0,
				},
			},
		]);
	});

	it("restores placement and total entries when beforeDeadline is toggled off", () => {
		const events = [
			TOURNAMENT_START,
			event("t-end", "session_end", localIso(2026, 4, 10, 23, 0), {
				beforeDeadline: true,
				prizeMoney: 20_000,
				bountyPrizes: 0,
			}),
		];
		const result = buildLiveLinkedEventEdits({
			values: TOURNAMENT_VALUES,
			events,
		});
		expect(result.edits).toEqual([
			{
				id: "t-end",
				payload: {
					beforeDeadline: false,
					placement: 3,
					totalEntries: 50,
					prizeMoney: 20_000,
					bountyPrizes: 0,
				},
			},
		]);
	});

	it("treats a blank bounty prize as zero", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, bountyPrizes: undefined },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([]);
	});

	it("syncs a bounty prize change", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, bountyPrizes: 3000 },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([
			{
				id: "t-end",
				payload: {
					beforeDeadline: false,
					placement: 3,
					totalEntries: 50,
					prizeMoney: 20_000,
					bountyPrizes: 3000,
				},
			},
		]);
	});

	it("requires a placement when the session did not end before registration close", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, placement: undefined },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual(["Placement is required"]);
	});

	it("requires total entries when the session did not end before registration close", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, totalEntries: undefined },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual(["Total entries is required"]);
	});

	it("rejects a placement greater than the total entries", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, placement: 51 },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual([
			"Placement must be less than or equal to total entries",
		]);
	});

	it("accepts a placement equal to the total entries", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, placement: 50 },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.errors).toEqual([]);
		expect(result.edits).toHaveLength(1);
	});

	it("requires prize money rather than silently saving a blank as zero", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, prizeMoney: undefined },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([]);
		expect(result.errors).toEqual(["Prize money is required"]);
	});

	it("never rewrites the session_start payload when only its time moves", () => {
		const result = buildLiveLinkedEventEdits({
			values: { ...TOURNAMENT_VALUES, startTime: "17:00" },
			events: TOURNAMENT_EVENTS,
		});
		expect(result.edits).toEqual([
			{ id: "t-start", occurredAt: unix(2026, 4, 10, 17, 0) },
		]);
	});
});
