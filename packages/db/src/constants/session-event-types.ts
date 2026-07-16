import z from "zod";

// Session statuses
export const SESSION_STATUSES = ["active", "paused", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// Event type categories
export const LIFECYCLE_EVENT_TYPES = ["session_start", "session_end"] as const;

export const PAUSE_RESUME_EVENT_TYPES = [
	"session_pause",
	"session_resume",
] as const;

export const CASH_EVENT_TYPES = ["chips_add_remove", "all_in"] as const;

export const TOURNAMENT_EVENT_TYPES = ["purchase_chips"] as const;

export const COMMON_EVENT_TYPES = [
	"update_stack",
	"player_join",
	"player_leave",
	"memo",
] as const;

// Virtual (non-currency) buy-in / cash-out events. Valid for both session
// kinds. Their amounts feed virtual P/L only and must never reach the
// currency ledger.
export const VIRTUAL_EVENT_TYPES = [
	"virtual_buy_in",
	"virtual_cash_out",
] as const;

export const ALL_EVENT_TYPES = [
	...LIFECYCLE_EVENT_TYPES,
	...PAUSE_RESUME_EVENT_TYPES,
	...CASH_EVENT_TYPES,
	...TOURNAMENT_EVENT_TYPES,
	...COMMON_EVENT_TYPES,
	...VIRTUAL_EVENT_TYPES,
] as const;

export type SessionEventType = (typeof ALL_EVENT_TYPES)[number];

// Event types that cannot be manually created (auto-created by session lifecycle only)
export const MANUAL_CREATE_BLOCKED_EVENT_TYPES: readonly string[] = [
	"session_start",
	"session_end",
] as const;

// --- Seat bounds ---
//
// Seats are 0-indexed. A 10-max table (the largest `tableSize` selectable in
// the ring-game / tournament / cash-game forms) therefore uses seat positions
// 0–9, so the last valid seat is 9. Every server-side `seatPosition` /
// `heroSeatPosition` bound derives from this single constant so the client's
// `MAX_SEAT_COUNT` (10) and the server's validation can never drift apart
// again (SA2-131).
export const MAX_SEAT_POSITION = 9;

// --- Payload Zod schemas ---

// Lifecycle payloads
export const cashSessionStartPayload = z.object({
	buyInAmount: z.number().int().min(0),
});

export const tournamentSessionStartPayload = z.object({
	timerStartedAt: z.number().int().nullable().optional(),
});

export const cashSessionEndPayload = z.object({
	cashOutAmount: z.number().int().min(0),
});

export const tournamentSessionEndPayload = z
	.discriminatedUnion("beforeDeadline", [
		z.object({
			beforeDeadline: z.literal(false),
			placement: z.number().int().min(1),
			totalEntries: z.number().int().min(1),
			prizeMoney: z.number().int().min(0),
			bountyPrizes: z.number().int().min(0),
		}),
		z.object({
			beforeDeadline: z.literal(true),
			prizeMoney: z.number().int().min(0),
			bountyPrizes: z.number().int().min(0),
		}),
	])
	.refine(
		(data) =>
			data.beforeDeadline === true || data.placement <= data.totalEntries,
		{
			message: "Placement must be less than or equal to total entries",
			path: ["placement"],
		}
	);

// Pause/Resume payloads
export const sessionPausePayload = z.object({});
export const sessionResumePayload = z.object({});

// Cash event payloads
//
// `chips_add_remove` uses a signed integer for `amount`: positive values
// represent adding chips (add-on / top-up), negative values represent
// removing chips (early cash-out). Zero is rejected to avoid storing
// no-op events.
export const chipsAddRemovePayload = z.object({
	amount: z
		.number()
		.int()
		.refine((n) => n !== 0, { message: "amount must be non-zero" }),
});

// `wins` is the number of favorable all-in run-outs across `trials`, counted as
// a fraction when the pot is chopped (a split counts as a partial win). It is
// therefore a non-negative number — NOT necessarily an integer — that never
// exceeds `trials`. The object-level `wins <= trials` refine blocks the real bug:
// a payload like `{ potSize: 1000, trials: 1, wins: 5 }` used to validate and let
// the EV math compute a wins-share larger than the pot, corrupting
// `evCashOut` / `evDiff` (SA2-156).
export const allInPayload = z
	.object({
		potSize: z.number().int().min(0),
		trials: z.number().int().min(1),
		equity: z.number().min(0).max(100),
		wins: z.number().min(0),
	})
	.refine((data) => data.wins <= data.trials, {
		message: "wins must not exceed trials",
		path: ["wins"],
	});

// Tournament event payloads
//
// `sessionChipPurchaseId` links the event to the rule-defined chip purchase
// (a `session_chip_purchase` row). name / cost / chips are kept as a
// denormalized snapshot for display and PL math even if the rule changes.
export const purchaseChipsPayload = z.object({
	sessionChipPurchaseId: z.string().min(1),
	name: z.string().min(1),
	cost: z.number().int().min(0),
	chips: z.number().int().min(0),
});

export const chipPurchaseCountSchema = z.object({
	name: z.string().min(1),
	count: z.number().int().min(0),
	chipsPerUnit: z.number().int().min(0),
});

// Common event payloads
//
// `update_stack` is shared between cash and tournament sessions. For
// tournaments, the payload may optionally carry remaining players, total
// entries, and chip purchase counts so that a single event captures both
// the stack snapshot and tournament-progress metadata. (`averageStack`
// is intentionally derived on read from startingStack, totalEntries,
// remainingPlayers, and chipPurchaseCounts and is therefore not stored
// on the payload.)
export const updateStackPayload = z.object({
	stackAmount: z.number().int().min(0),
	remainingPlayers: z.number().int().min(1).nullable().optional(),
	totalEntries: z.number().int().min(1).nullable().optional(),
	chipPurchaseCounts: z.array(chipPurchaseCountSchema).optional(),
});

export const playerJoinPayload = z.object({
	playerId: z.string().min(1).optional(),
	isHero: z.boolean().default(false),
	seatPosition: z.number().int().min(0).max(MAX_SEAT_POSITION).optional(),
});

export const playerLeavePayload = z.object({
	playerId: z.string().min(1).optional(),
	isHero: z.boolean().default(false),
});

export const memoPayload = z.object({
	text: z.string().min(1),
});

// Virtual event payloads
//
// A virtual buy-in / cash-out is either item-based (itemId set, with
// itemName / unitValue / currencyId denormalized as a snapshot frozen at
// usage time — the purchase_chips precedent) or pure-virtual (all item
// fields null, free `amount`). `amount` is the total currency-equivalent
// value: for item usages it must equal count × unitValue (a zero-value item
// is allowed so holdings of worthless tickets stay trackable); pure-virtual
// amounts must be ≥ 1 to avoid storing no-op events (the chips_add_remove
// precedent).
export const virtualAmountPayload = z
	.object({
		amount: z.number().int().min(0),
		itemId: z.string().min(1).nullable(),
		itemName: z.string().min(1).nullable(),
		count: z.number().int().min(1).nullable(),
		unitValue: z.number().int().min(0).nullable(),
		currencyId: z.string().min(1).nullable(),
	})
	.refine(
		(data) =>
			data.itemId === null
				? data.itemName === null &&
					data.count === null &&
					data.unitValue === null
				: data.itemName !== null &&
					data.count !== null &&
					data.unitValue !== null,
		{
			message: "item fields must be all set or all null",
			path: ["itemId"],
		}
	)
	.refine(
		(data) =>
			data.itemId === null ||
			data.count === null ||
			data.unitValue === null ||
			data.amount === data.count * data.unitValue,
		{
			message: "amount must equal count × unitValue for item usages",
			path: ["amount"],
		}
	)
	.refine((data) => data.itemId !== null || data.amount >= 1, {
		message: "pure-virtual amount must be at least 1",
		path: ["amount"],
	});

// --- Payload schema map ---

// Session-type-aware payload schemas for session_start and session_end
export const SESSION_START_PAYLOAD_SCHEMAS = {
	cash_game: cashSessionStartPayload,
	tournament: tournamentSessionStartPayload,
} as const;

export const SESSION_END_PAYLOAD_SCHEMAS = {
	cash_game: cashSessionEndPayload,
	tournament: tournamentSessionEndPayload,
} as const;

// General payload schema map (for non-session-type-dependent events)
export const EVENT_PAYLOAD_SCHEMAS: Record<
	Exclude<SessionEventType, "session_start" | "session_end">,
	z.ZodTypeAny
> = {
	session_pause: sessionPausePayload,
	session_resume: sessionResumePayload,
	chips_add_remove: chipsAddRemovePayload,
	all_in: allInPayload,
	purchase_chips: purchaseChipsPayload,
	update_stack: updateStackPayload,
	player_join: playerJoinPayload,
	player_leave: playerLeavePayload,
	memo: memoPayload,
	virtual_buy_in: virtualAmountPayload,
	virtual_cash_out: virtualAmountPayload,
};

// Helper to validate payload for a given event type
export function validateEventPayload(
	eventType: SessionEventType,
	payload: unknown,
	sessionType?: "cash_game" | "tournament"
) {
	if (eventType === "session_start") {
		const schema = SESSION_START_PAYLOAD_SCHEMAS[sessionType ?? "tournament"];
		return schema.parse(payload);
	}
	if (eventType === "session_end") {
		const schema = SESSION_END_PAYLOAD_SCHEMAS[sessionType ?? "tournament"];
		return schema.parse(payload);
	}
	const schema = EVENT_PAYLOAD_SCHEMAS[eventType];
	return schema.parse(payload);
}

// Event type validation by session type
export function isValidEventTypeForSessionType(
	eventType: SessionEventType,
	sessionType: "cash_game" | "tournament"
): boolean {
	const lifecycleTypes: readonly string[] = LIFECYCLE_EVENT_TYPES;
	if (lifecycleTypes.includes(eventType)) {
		return true;
	}

	const pauseResumeTypes: readonly string[] = PAUSE_RESUME_EVENT_TYPES;
	if (pauseResumeTypes.includes(eventType)) {
		return true;
	}

	const commonTypes: readonly string[] = COMMON_EVENT_TYPES;
	if (commonTypes.includes(eventType)) {
		return true;
	}

	const virtualTypes: readonly string[] = VIRTUAL_EVENT_TYPES;
	if (virtualTypes.includes(eventType)) {
		return true;
	}

	if (sessionType === "cash_game") {
		const cashTypes: readonly string[] = CASH_EVENT_TYPES;
		return cashTypes.includes(eventType);
	}

	if (sessionType === "tournament") {
		const tournamentTypes: readonly string[] = TOURNAMENT_EVENT_TYPES;
		return tournamentTypes.includes(eventType);
	}

	return false;
}

// --- Session state helpers ---

interface EventForState {
	eventType: string;
	id?: string;
	occurredAt: Date | string;
	sortOrder: number;
}

/**
 * Derive the current session state from the event stream.
 * - completed: session_end exists
 * - paused: latest lifecycle/pause/resume event is session_pause
 * - active: otherwise (session_start or session_resume is latest)
 */
export function getSessionCurrentState(events: EventForState[]): SessionStatus {
	const hasSessionEnd = events.some((e) => e.eventType === "session_end");
	if (hasSessionEnd) {
		return "completed";
	}

	const stateEvents = events.filter(
		(e) =>
			e.eventType === "session_start" ||
			e.eventType === "session_pause" ||
			e.eventType === "session_resume"
	);

	if (stateEvents.length === 0) {
		return "active";
	}

	// Sort by occurredAt desc, then sortOrder desc to find latest
	const sorted = [...stateEvents].sort((a, b) => {
		const timeA = new Date(a.occurredAt).getTime();
		const timeB = new Date(b.occurredAt).getTime();
		if (timeB !== timeA) {
			return timeB - timeA;
		}
		if (b.sortOrder !== a.sortOrder) {
			return b.sortOrder - a.sortOrder;
		}
		return (b.id ?? "").localeCompare(a.id ?? "");
	});

	const latest = sorted[0] as EventForState | undefined;
	if (latest?.eventType === "session_pause") {
		return "paused";
	}

	return "active";
}

// Events allowed per session state
const EVENTS_ALLOWED_WHEN_ACTIVE: readonly string[] = [
	...CASH_EVENT_TYPES,
	...TOURNAMENT_EVENT_TYPES,
	...COMMON_EVENT_TYPES,
	...VIRTUAL_EVENT_TYPES,
	"session_pause",
	"session_end",
];

const EVENTS_ALLOWED_WHEN_PAUSED: readonly string[] = [
	"memo",
	"session_resume",
	"session_end",
];

/**
 * Check if an event type is allowed given the current session state.
 * Lifecycle events (session_start) are never manually created, so not checked here.
 */
export function isEventAllowedInState(
	eventType: SessionEventType,
	state: SessionStatus
): boolean {
	if (state === "completed") {
		return false;
	}

	if (state === "paused") {
		return EVENTS_ALLOWED_WHEN_PAUSED.includes(eventType);
	}

	// active
	return EVENTS_ALLOWED_WHEN_ACTIVE.includes(eventType);
}
