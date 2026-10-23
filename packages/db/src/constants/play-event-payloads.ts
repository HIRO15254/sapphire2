import z from "zod";
import { END_STATES_REQUIRING_STACK, type EntryKind } from "./entry";
import { LEDGER_EFFECTS, LEDGER_MAX_QUANTITY, type LedgerRole } from "./ledger";
import {
	ALL_EVENT_TYPES,
	allInPayload,
	chipsAddRemovePayload,
	EVENT_PAYLOAD_SCHEMAS,
	isValidEventTypeForSessionType,
	memoPayload,
	playerJoinPayload,
	playerLeavePayload,
	SESSION_END_PAYLOAD_SCHEMAS,
	SESSION_START_PAYLOAD_SCHEMAS,
	type SessionEventType,
	sessionPausePayload,
	sessionResumePayload,
	updateStackPayload,
} from "./session-event-types";

export function paymentsSchema<
	const Roles extends readonly [LedgerRole, ...LedgerRole[]],
>(roles: Roles) {
	return z.array(
		z.object({
			assetId: z.string().min(1),
			quantity: z.number().int().min(1).max(LEDGER_MAX_QUANTITY),
			role: z.enum(roles),
			effect: z.enum(LEDGER_EFFECTS).default("real"),
			priceId: z.string().min(1).optional(),
		})
	);
}

const clockFields = {
	timerStartedAt: z.number().int().nullable().optional(),
	startLevel: z.number().int().min(0).optional(),
};

export const cashSessionStartPayloadV2 = z.object({
	payments: paymentsSchema(["buy_in"]).optional(),
	...clockFields,
});

export const tournamentSessionStartPayloadV2 = z.object({
	payments: paymentsSchema(["buy_in", "fee"]).optional(),
	...clockFields,
});

export const cashSessionEndPayloadV2 = z.object({
	payments: paymentsSchema(["cash_out"]),
});

const prizePayments = paymentsSchema(["prize", "bounty"]);

export const tournamentSessionEndPayloadV2 = z
	.discriminatedUnion("beforeDeadline", [
		z.object({
			beforeDeadline: z.literal(false),
			placement: z.number().int().min(1),
			totalEntries: z.number().int().min(1),
			payments: prizePayments,
		}),
		z.object({
			beforeDeadline: z.literal(true),
			payments: prizePayments,
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

export const dayEndPayload = z.object({
	endState: z.enum(END_STATES_REQUIRING_STACK),
	stackAmount: z.number().int().min(0),
});

export const updateStackPayloadV2 = updateStackPayload.omit({
	chipPurchaseCounts: true,
});

export const reentryPayload = z.object({
	payments: paymentsSchema(["reentry", "fee"]),
});

export const purchaseChipsPayloadV2 = z.object({
	priceId: z.string().min(1),
	label: z.string().min(1),
	chips: z.number().int().min(0),
	payments: paymentsSchema(["chip_purchase"]),
});

const SHARED_PAYLOADS_V2 = {
	session_pause: sessionPausePayload,
	session_resume: sessionResumePayload,
	day_end: dayEndPayload,
	update_stack: updateStackPayloadV2,
	player_join: playerJoinPayload,
	player_leave: playerLeavePayload,
	memo: memoPayload,
} as const satisfies Record<string, z.ZodType>;

const PAYLOADS_V2: Record<EntryKind, Record<string, z.ZodType>> = {
	cash: {
		...SHARED_PAYLOADS_V2,
		session_start: cashSessionStartPayloadV2,
		session_end: cashSessionEndPayloadV2,
		chips_add_remove: chipsAddRemovePayload,
		all_in: allInPayload,
	},
	tournament: {
		...SHARED_PAYLOADS_V2,
		session_start: tournamentSessionStartPayloadV2,
		session_end: tournamentSessionEndPayloadV2,
		reentry: reentryPayload,
		purchase_chips: purchaseChipsPayloadV2,
	},
};

function isSessionEventType(type: string): type is SessionEventType {
	return (ALL_EVENT_TYPES as readonly string[]).includes(type);
}

function payloadSchemaV1(kind: EntryKind, type: string): z.ZodType | null {
	const sessionType = kind === "cash" ? "cash_game" : "tournament";
	if (
		!(
			isSessionEventType(type) &&
			isValidEventTypeForSessionType(type, sessionType)
		)
	) {
		return null;
	}
	if (type === "session_start") {
		return SESSION_START_PAYLOAD_SCHEMAS[sessionType];
	}
	if (type === "session_end") {
		return SESSION_END_PAYLOAD_SCHEMAS[sessionType];
	}
	return EVENT_PAYLOAD_SCHEMAS[type];
}

export function playEventPayloadSchema(
	kind: EntryKind,
	type: string,
	schemaVersion: number
): z.ZodType | null {
	if (schemaVersion === 1) {
		return payloadSchemaV1(kind, type);
	}
	if (schemaVersion === 2) {
		const schemas = PAYLOADS_V2[kind];
		return Object.hasOwn(schemas, type) ? (schemas[type] ?? null) : null;
	}
	return null;
}
