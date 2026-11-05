import z from "zod";
import { END_STATES_REQUIRING_STACK, type EntryKind } from "./entry";
import { MAX_SEAT_POSITION } from "./hand";
import { LEDGER_EFFECTS, LEDGER_MAX_QUANTITY, type LedgerRole } from "./ledger";

export const PLAY_EVENT_SCHEMA_VERSION = 2;

export const ledgerQuantitySchema = z
	.number()
	.int()
	.min(1)
	.max(LEDGER_MAX_QUANTITY);

export const signedLedgerQuantitySchema = z
	.number()
	.int()
	.min(-LEDGER_MAX_QUANTITY)
	.max(LEDGER_MAX_QUANTITY)
	.refine((quantity) => quantity !== 0, {
		message: "A ledger quantity cannot be zero",
	});

export function paymentsSchema<
	const Roles extends readonly [LedgerRole, ...LedgerRole[]],
>(roles: Roles) {
	return z.array(
		z.object({
			assetId: z.string().min(1),
			quantity: ledgerQuantitySchema,
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

export const cashSessionStartPayload = z.object({
	payments: paymentsSchema(["buy_in"]).optional(),
	...clockFields,
});

export const tournamentSessionStartPayload = z.object({
	payments: paymentsSchema(["buy_in", "fee"]).optional(),
	...clockFields,
});

export const cashSessionEndPayload = z.object({
	payments: paymentsSchema(["cash_out"]),
});

const prizePayments = paymentsSchema(["prize", "bounty"]);

export const tournamentSessionEndPayload = z
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

export const sessionPausePayload = z.object({});
export const sessionResumePayload = z.object({});

export const chipsAddRemovePayload = z.object({
	// NOTE(rule): api-data-integrity.md — amount deviates from .int().min(0) by design: positive = chips added (add-on / top-up), negative = chips removed (early cash-out); zero rejected so no-op events are never stored.
	amount: z
		.number()
		.int()
		.refine((n) => n !== 0, { message: "amount must be non-zero" }),
	assetId: z.string().min(1),
	effect: z.enum(LEDGER_EFFECTS).default("real"),
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

export const reentryPayload = z.object({
	payments: paymentsSchema(["reentry", "fee"]),
});

export const purchaseChipsPayload = z.object({
	priceId: z.string().min(1),
	label: z.string().min(1),
	chips: z.number().int().min(0),
	payments: paymentsSchema(["chip_purchase"]),
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
	playerId: z.string().min(1),
	seatPosition: z.number().int().min(0).max(MAX_SEAT_POSITION).optional(),
});

export const playerLeavePayload = z.object({
	playerId: z.string().min(1),
});

export const memoPayload = z.object({
	text: z.string().min(1),
});

const SHARED_PAYLOADS = {
	session_pause: sessionPausePayload,
	session_resume: sessionResumePayload,
	day_end: dayEndPayload,
	update_stack: updateStackPayload,
	player_join: playerJoinPayload,
	player_leave: playerLeavePayload,
	memo: memoPayload,
} as const satisfies Record<string, z.ZodType>;

const PAYLOADS: Record<EntryKind, Record<string, z.ZodType>> = {
	cash: {
		...SHARED_PAYLOADS,
		session_start: cashSessionStartPayload,
		session_end: cashSessionEndPayload,
		chips_add_remove: chipsAddRemovePayload,
		all_in: allInPayload,
	},
	tournament: {
		...SHARED_PAYLOADS,
		session_start: tournamentSessionStartPayload,
		session_end: tournamentSessionEndPayload,
		reentry: reentryPayload,
		purchase_chips: purchaseChipsPayload,
	},
};

export function playEventPayloadSchema(
	kind: EntryKind,
	type: string
): z.ZodType | null {
	const schemas = PAYLOADS[kind];
	return Object.hasOwn(schemas, type) ? (schemas[type] ?? null) : null;
}
