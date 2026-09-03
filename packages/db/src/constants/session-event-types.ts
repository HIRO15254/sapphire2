import z from "zod";

export const SESSION_STATUSES = ["active", "paused", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

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

export const ALL_EVENT_TYPES = [
	...LIFECYCLE_EVENT_TYPES,
	...PAUSE_RESUME_EVENT_TYPES,
	...CASH_EVENT_TYPES,
	...TOURNAMENT_EVENT_TYPES,
	...COMMON_EVENT_TYPES,
] as const;

export type SessionEventType = (typeof ALL_EVENT_TYPES)[number];

export const MANUAL_CREATE_BLOCKED_EVENT_TYPES: readonly string[] = [
	"session_start",
	"session_end",
] as const;

export const MAX_SEAT_POSITION = 9;

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

export const sessionPausePayload = z.object({});
export const sessionResumePayload = z.object({});

export const chipsAddRemovePayload = z.object({
	// NOTE(rule): api-data-integrity.md — amount deviates from .int().min(0) by design: positive = chips added (add-on / top-up), negative = chips removed (early cash-out); zero rejected so no-op events are never stored.
	amount: z
		.number()
		.int()
		.refine((n) => n !== 0, { message: "amount must be non-zero" }),
});

export const allInPayload = z
	.object({
		potSize: z.number().int().min(0),
		trials: z.number().int().min(1),
		equity: z.number().min(0).max(100),
		// NOTE(rule): api-data-integrity.md — wins deviates from .int(): chopped pots count as fractional wins; non-negative, and the object-level refine (wins <= trials) blocks the EV-corruption bug (SA2-156).
		wins: z.number().min(0),
	})
	.refine((data) => data.wins <= data.trials, {
		message: "wins must not exceed trials",
		path: ["wins"],
	});

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

export const SESSION_START_PAYLOAD_SCHEMAS = {
	cash_game: cashSessionStartPayload,
	tournament: tournamentSessionStartPayload,
} as const;

export const SESSION_END_PAYLOAD_SCHEMAS = {
	cash_game: cashSessionEndPayload,
	tournament: tournamentSessionEndPayload,
} as const;

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
};

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

interface EventForState {
	eventType: string;
	id?: string;
	occurredAt: Date | string;
	sortOrder: number;
}

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

const EVENTS_ALLOWED_WHEN_ACTIVE: readonly string[] = [
	...CASH_EVENT_TYPES,
	...TOURNAMENT_EVENT_TYPES,
	...COMMON_EVENT_TYPES,
	"session_pause",
	"session_end",
];

const EVENTS_ALLOWED_WHEN_PAUSED: readonly string[] = [
	"memo",
	"session_resume",
	"session_end",
];

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

	return EVENTS_ALLOWED_WHEN_ACTIVE.includes(eventType);
}
