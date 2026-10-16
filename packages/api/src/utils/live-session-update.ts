import type { Database } from "@sapphire2/db";
import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/session-event-types";
import { type entry, playSession } from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import z from "zod";

export const handCountSchema = z.number().int().min(0).optional();

export const dealerSeatSchema = z
	.number()
	.int()
	.min(0)
	.max(MAX_SEAT_POSITION)
	.optional();

export async function assertHandTrackingEditable(
	db: Database,
	userId: string,
	entryId: string,
	input: { dealerSeat?: number; handCount?: number }
): Promise<void> {
	if (input.handCount === undefined && input.dealerSeat === undefined) {
		return;
	}
	const [unfinished] = await db
		.select({ status: playSession.status })
		.from(playSession)
		.where(
			and(
				eq(playSession.entryId, entryId),
				eq(playSession.userId, userId),
				ne(playSession.status, "ended")
			)
		);
	if (unfinished?.status !== "active") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Hand count can only be changed while the session is active",
		});
	}
}

export function buildHandTrackingStatements(
	db: Database,
	userId: string,
	entryId: string,
	input: { dealerSeat?: number; handCount?: number }
) {
	if (input.handCount === undefined && input.dealerSeat === undefined) {
		return [];
	}
	return [
		db
			.update(gameSession)
			.set({
				...(input.handCount === undefined
					? {}
					: { handCount: input.handCount }),
				...(input.dealerSeat === undefined
					? {}
					: { dealerSeat: input.dealerSeat }),
			})
			.where(and(eq(gameSession.id, entryId), eq(gameSession.userId, userId))),
	];
}

export function buildLiveSessionUpdateData(input: {
	currencyId?: string | null;
	dealerSeat?: number;
	handCount?: number;
	memo?: string | null;
	roomId?: string | null;
}): Partial<typeof entry.$inferInsert> {
	const updateData: Partial<typeof entry.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.memo !== undefined) {
		updateData.memo = input.memo;
	}
	if (input.roomId !== undefined) {
		updateData.roomId = input.roomId;
	}
	if (input.currencyId !== undefined) {
		updateData.assetId = input.currencyId;
	}
	return updateData;
}
