import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/hand";
import { idSchema } from "@sapphire2/db/schemas/id";
import { tagIdsSchema } from "@sapphire2/db/schemas/tag-ids";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { memoSchema, playerNameSchema } from "../lib/master-input-schemas";

import {
	addNewTablePlayer,
	addTablePlayer,
	addTemporaryTablePlayer,
	listTablePlayers,
	removeTablePlayer,
	updateTablePlayerSeat,
} from "../services/table-player";

const seatPositionSchema = z.number().int().min(0).max(MAX_SEAT_POSITION);

export const tablePlayerRouter = router({
	add: protectedProcedure
		.input(
			z.object({
				entryId: idSchema,
				playerId: idSchema,
				seatPosition: seatPositionSchema.optional(),
			})
		)
		.mutation(
			async ({ ctx, input }) =>
				await addTablePlayer(ctx.db, ctx.session.user.id, input, new Date())
		),

	addNew: protectedProcedure
		.input(
			z.object({
				entryId: idSchema,
				playerMemo: memoSchema.optional(),
				playerName: playerNameSchema,
				playerTagIds: tagIdsSchema.optional(),
				seatPosition: seatPositionSchema.optional(),
			})
		)
		.mutation(
			async ({ ctx, input }) =>
				await addNewTablePlayer(ctx.db, ctx.session.user.id, input, new Date())
		),

	addTemporary: protectedProcedure
		.input(
			z.object({
				entryId: idSchema,
				seatPosition: seatPositionSchema.optional(),
			})
		)
		.mutation(
			async ({ ctx, input }) =>
				await addTemporaryTablePlayer(
					ctx.db,
					ctx.session.user.id,
					input,
					new Date()
				)
		),
	list: protectedProcedure
		.input(z.object({ activeOnly: z.boolean().optional(), entryId: idSchema }))
		.query(async ({ ctx, input }) => ({
			items: await listTablePlayers(ctx.db, ctx.session.user.id, input),
		})),

	remove: protectedProcedure
		.input(z.object({ entryId: idSchema, playerId: idSchema }))
		.mutation(
			async ({ ctx, input }) =>
				await removeTablePlayer(ctx.db, ctx.session.user.id, input, new Date())
		),

	updateSeat: protectedProcedure
		.input(
			z.object({
				entryId: idSchema,
				playerId: idSchema,
				seatPosition: seatPositionSchema.nullable(),
			})
		)
		.mutation(
			async ({ ctx, input }) =>
				await updateTablePlayerSeat(
					ctx.db,
					ctx.session.user.id,
					input,
					new Date()
				)
		),
});
