import { idSchema } from "@sapphire2/db/schemas/id";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	addHand,
	DEFAULT_HAND_PAGE_SIZE,
	deleteHand,
	getHand,
	handAddInputSchema,
	handUpdateInputSchema,
	listHands,
	MAX_HAND_PAGE_SIZE,
	undoLastHand,
	updateHand,
} from "../services/hand";

export const handIdInputSchema = z.object({ id: idSchema });

export const handListInputSchema = z.object({
	cursor: z.string().optional(),
	limit: z
		.number()
		.int()
		.min(1)
		.max(MAX_HAND_PAGE_SIZE)
		.default(DEFAULT_HAND_PAGE_SIZE),
	playSessionId: idSchema,
});

export const handUndoLastInputSchema = z.object({ playSessionId: idSchema });

export const handRouter = router({
	add: protectedProcedure
		.input(handAddInputSchema)
		.mutation(({ ctx, input }) =>
			addHand(ctx.db, ctx.session.user.id, input, new Date())
		),

	delete: protectedProcedure
		.input(handIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			await deleteHand(ctx.db, ctx.session.user.id, input.id);
			return { success: true as const };
		}),

	getById: protectedProcedure
		.input(handIdInputSchema)
		.query(({ ctx, input }) => getHand(ctx.db, ctx.session.user.id, input.id)),
	list: protectedProcedure
		.input(handListInputSchema)
		.query(({ ctx, input }) => listHands(ctx.db, ctx.session.user.id, input)),

	undoLast: protectedProcedure
		.input(handUndoLastInputSchema)
		.mutation(async ({ ctx, input }) => {
			await undoLastHand(ctx.db, ctx.session.user.id, input.playSessionId);
			return { success: true as const };
		}),

	update: protectedProcedure
		.input(handUpdateInputSchema)
		.mutation(({ ctx, input }) =>
			updateHand(ctx.db, ctx.session.user.id, input, new Date())
		),
});
