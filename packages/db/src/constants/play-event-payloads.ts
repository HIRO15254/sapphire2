import z from "zod";
import { END_STATES_REQUIRING_STACK } from "./entry";
import { LEDGER_EFFECTS, LEDGER_MAX_QUANTITY, type LedgerRole } from "./ledger";
import { updateStackPayload } from "./session-event-types";

function paymentsSchema<
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
