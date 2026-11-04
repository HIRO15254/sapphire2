import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	addHand,
	DEFAULT_HAND_PAGE_SIZE,
	deleteHand,
	getHand,
	handAddInputSchema,
	listHands,
	MAX_HAND_PAGE_SIZE,
	undoLastHand,
} from "../services/hand";

export const handIdInputSchema = z.object({ id: z.string() });

export const handListInputSchema = z.object({
	playSessionId: z.string(),
	cursor: z.string().optional(),
	limit: z
		.number()
		.int()
		.min(1)
		.max(MAX_HAND_PAGE_SIZE)
		.default(DEFAULT_HAND_PAGE_SIZE),
});

export const handUndoLastInputSchema = z.object({ playSessionId: z.string() });

export const handRouter = router({
	list: protectedProcedure
		.input(handListInputSchema)
		.query(({ ctx, input }) => listHands(ctx.db, ctx.session.user.id, input)),

	getById: protectedProcedure
		.input(handIdInputSchema)
		.query(({ ctx, input }) => getHand(ctx.db, ctx.session.user.id, input.id)),

	add: protectedProcedure
		.input(handAddInputSchema)
		.mutation(({ ctx, input }) =>
			addHand(ctx.db, ctx.session.user.id, input, new Date())
		),

	undoLast: protectedProcedure
		.input(handUndoLastInputSchema)
		.mutation(async ({ ctx, input }) => {
			await undoLastHand(ctx.db, ctx.session.user.id, input.playSessionId);
			return { success: true as const };
		}),

	delete: protectedProcedure
		.input(handIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			await deleteHand(ctx.db, ctx.session.user.id, input.id);
			return { success: true as const };
		}),
});
