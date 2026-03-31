import { z } from "zod";

// Session statuses
export const SESSION_STATUSES = ["active", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// Event types - generic (shared across cash game / tournament)
export const GENERIC_EVENT_TYPES = ["chip_add", "stack_record"] as const;

export const TOURNAMENT_EVENT_TYPES = [
	"tournament_stack_record",
	"tournament_result",
] as const;

export const COMMON_EVENT_TYPES = ["player_join", "player_leave"] as const;

export const LIFECYCLE_EVENT_TYPES = ["session_start", "session_end"] as const;

export const ALL_EVENT_TYPES = [
	...GENERIC_EVENT_TYPES,
	...TOURNAMENT_EVENT_TYPES,
	...COMMON_EVENT_TYPES,
	...LIFECYCLE_EVENT_TYPES,
] as const;

export type SessionEventType = (typeof ALL_EVENT_TYPES)[number];

// Event types that cannot be manually created (auto-created by session lifecycle only)
export const MANUAL_CREATE_BLOCKED_EVENT_TYPES: readonly string[] = [
	"session_start",
	"session_end",
] as const;

// Payload Zod schemas
export const chipAddPayload = z.object({
	amount: z.number().int().min(0),
});

export const allInSchema = z.object({
	potSize: z.number().min(0),
	trials: z.number().int().min(1),
	equity: z.number().min(0).max(100),
	wins: z.number().min(0),
});

export const stackRecordPayload = z.object({
	stackAmount: z.number().int().min(0),
	allIns: z.array(allInSchema).default([]),
});

export const tournamentRebuySchema = z.object({
	cost: z.number().int().min(0),
	chips: z.number().int().min(0),
});

export const tournamentAddonSchema = z.object({
	cost: z.number().int().min(0),
	chips: z.number().int().min(0),
});

export const tournamentStackRecordPayload = z.object({
	stackAmount: z.number().int().min(0),
	remainingPlayers: z.number().int().min(1).nullable().default(null),
	averageStack: z.number().int().min(0).nullable().default(null),
	rebuy: tournamentRebuySchema.nullable().default(null),
	addon: tournamentAddonSchema.nullable().default(null),
});

export const tournamentResultPayload = z.object({
	placement: z.number().int().min(1),
	totalEntries: z.number().int().min(1),
	prizeMoney: z.number().int().min(0),
	bountyPrizes: z.number().int().min(0).nullable().default(null),
});

export const playerJoinPayload = z.object({
	playerId: z.string().min(1),
});

export const playerLeavePayload = z.object({
	playerId: z.string().min(1),
});

export const sessionStartPayload = z.object({});

export const sessionEndPayload = z.object({});

// Payload schema map for dispatch
export const EVENT_PAYLOAD_SCHEMAS: Record<SessionEventType, z.ZodTypeAny> = {
	chip_add: chipAddPayload,
	stack_record: stackRecordPayload,
	tournament_stack_record: tournamentStackRecordPayload,
	tournament_result: tournamentResultPayload,
	player_join: playerJoinPayload,
	player_leave: playerLeavePayload,
	session_start: sessionStartPayload,
	session_end: sessionEndPayload,
};

// Helper to validate payload for a given event type
export function validateEventPayload(
	eventType: SessionEventType,
	payload: unknown
) {
	const schema = EVENT_PAYLOAD_SCHEMAS[eventType];
	return schema.parse(payload);
}

// Event type validation by session type
export function isValidEventTypeForSessionType(
	eventType: SessionEventType,
	sessionType: "cash_game" | "tournament"
): boolean {
	const commonTypes: readonly string[] = COMMON_EVENT_TYPES;
	if (commonTypes.includes(eventType)) {
		return true;
	}

	const lifecycleTypes: readonly string[] = LIFECYCLE_EVENT_TYPES;
	if (lifecycleTypes.includes(eventType)) {
		return true;
	}

	const genericTypes: readonly string[] = GENERIC_EVENT_TYPES;
	if (genericTypes.includes(eventType)) {
		return true;
	}

	if (sessionType === "tournament") {
		const tournamentTypes: readonly string[] = TOURNAMENT_EVENT_TYPES;
		return tournamentTypes.includes(eventType);
	}

	return false;
}
