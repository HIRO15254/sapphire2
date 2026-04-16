import { z } from "zod";

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

export const TOURNAMENT_EVENT_TYPES = [
	"purchase_chips",
	"update_tournament_info",
] as const;

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

// Event types that cannot be manually created (auto-created by session lifecycle only)
export const MANUAL_CREATE_BLOCKED_EVENT_TYPES: readonly string[] = [
	"session_start",
	"session_end",
] as const;

// --- Payload Zod schemas ---

// Lifecycle payloads
export const cashSessionStartPayload = z.object({
	buyInAmount: z.number().int().min(0),
});

export const tournamentSessionStartPayload = z.object({});

export const cashSessionEndPayload = z.object({
	cashOutAmount: z.number().int().min(0),
});

export const tournamentSessionEndPayload = z.discriminatedUnion(
	"beforeDeadline",
	[
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
	]
);

// Pause/Resume payloads
export const sessionPausePayload = z.object({});
export const sessionResumePayload = z.object({});

// Cash event payloads
export const chipsAddRemovePayload = z.object({
	amount: z.number().int().min(0),
	type: z.enum(["add", "remove"]),
});

export const allInPayload = z.object({
	potSize: z.number().min(0),
	trials: z.number().int().min(1),
	equity: z.number().min(0).max(100),
	wins: z.number().min(0),
});

// Tournament event payloads
export const purchaseChipsPayload = z.object({
	name: z.string().min(1),
	cost: z.number().int().min(0),
	chips: z.number().int().min(0),
});

export const chipPurchaseCountSchema = z.object({
	name: z.string().min(1),
	count: z.number().int().min(0),
	chipsPerUnit: z.number().int().min(0),
});

export const updateTournamentInfoPayload = z.object({
	remainingPlayers: z.number().int().min(1).nullable().default(null),
	totalEntries: z.number().int().min(1).nullable().default(null),
	averageStack: z.number().int().min(0).nullable().default(null),
	chipPurchaseCounts: z.array(chipPurchaseCountSchema).default([]),
});

// Common event payloads
export const updateStackPayload = z.object({
	stackAmount: z.number().int().min(0),
});

export const playerJoinPayload = z.object({
	playerId: z.string().min(1).optional(),
	isHero: z.boolean().default(false),
});

export const playerLeavePayload = z.object({
	playerId: z.string().min(1).optional(),
	isHero: z.boolean().default(false),
});

export const memoPayload = z.object({
	text: z.string().min(1),
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
	update_tournament_info: updateTournamentInfoPayload,
	update_stack: updateStackPayload,
	player_join: playerJoinPayload,
	player_leave: playerLeavePayload,
	memo: memoPayload,
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
		return b.sortOrder - a.sortOrder;
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
