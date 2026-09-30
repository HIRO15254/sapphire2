import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/session-event-types";
import type { gameSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const handCountSchema = z.number().int().min(0).optional();

export const dealerSeatSchema = z
	.number()
	.int()
	.min(0)
	.max(MAX_SEAT_POSITION)
	.optional();

export function assertHandTrackingEditable(
	status: string,
	input: { dealerSeat?: number; handCount?: number }
): void {
	if (input.handCount === undefined && input.dealerSeat === undefined) {
		return;
	}
	if (status !== "active") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Hand count can only be changed while the session is active",
		});
	}
}

export function buildLiveSessionUpdateData(input: {
	currencyId?: string | null;
	dealerSeat?: number;
	handCount?: number;
	memo?: string | null;
	roomId?: string | null;
}): Partial<typeof gameSession.$inferInsert> {
	const updateData: Partial<typeof gameSession.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.memo !== undefined) {
		updateData.memo = input.memo;
	}
	if (input.roomId !== undefined) {
		updateData.roomId = input.roomId;
	}
	if (input.currencyId !== undefined) {
		updateData.currencyId = input.currencyId;
	}
	if (input.handCount !== undefined) {
		updateData.handCount = input.handCount;
	}
	if (input.dealerSeat !== undefined) {
		updateData.dealerSeat = input.dealerSeat;
	}
	return updateData;
}
