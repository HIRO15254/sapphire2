import { z } from "zod";

// Session statuses
export const SESSION_STATUSES = ["active", "paused", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// Event types
export const CASH_GAME_EVENT_TYPES = [
	"cash_game_buy_in",
	"cash_game_stack_record",
	"cash_out",
] as const;

export const TOURNAMENT_EVENT_TYPES = [
	"tournament_stack_record",
	"tournament_result",
] as const;

export const COMMON_EVENT_TYPES = [
	"player_join",
	"player_leave",
	"session_pause",
	"session_resume",
] as const;

export const ALL_EVENT_TYPES = [
	...CASH_GAME_EVENT_TYPES,
	...TOURNAMENT_EVENT_TYPES,
	...COMMON_EVENT_TYPES,
] as const;

export type SessionEventType = (typeof ALL_EVENT_TYPES)[number];

// Payload Zod schemas
export const cashGameBuyInPayload = z.object({
	amount: z.number().int().min(0),
});

export const allInSchema = z.object({
	actualResult: z.number(),
	evResult: z.number(),
});

export const addonSchema = z.object({
	amount: z.number().int().min(0),
});

export const cashGameStackRecordPayload = z.object({
	stackAmount: z.number().int().min(0),
	allIns: z.array(allInSchema).default([]),
	addon: addonSchema.nullable().default(null),
});

export const cashOutPayload = z.object({
	amount: z.number().int().min(0),
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

export const sessionPausePayload = z.object({});

export const sessionResumePayload = z.object({});

// Payload schema map for dispatch
export const EVENT_PAYLOAD_SCHEMAS: Record<SessionEventType, z.ZodTypeAny> = {
	cash_game_buy_in: cashGameBuyInPayload,
	cash_game_stack_record: cashGameStackRecordPayload,
	cash_out: cashOutPayload,
	tournament_stack_record: tournamentStackRecordPayload,
	tournament_result: tournamentResultPayload,
	player_join: playerJoinPayload,
	player_leave: playerLeavePayload,
	session_pause: sessionPausePayload,
	session_resume: sessionResumePayload,
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

	if (sessionType === "cash_game") {
		const cashTypes: readonly string[] = CASH_GAME_EVENT_TYPES;
		return cashTypes.includes(eventType);
	}
	const tournamentTypes: readonly string[] = TOURNAMENT_EVENT_TYPES;
	return tournamentTypes.includes(eventType);
}
