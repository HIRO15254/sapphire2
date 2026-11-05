import z from "zod";
import { protectedProcedure, router } from "../index";
import { instantSchema } from "../lib/date-only";
import {
	createPlayEvent,
	deletePlayEvent,
	listPlayEvents,
	PLAY_EVENT_INPUT_PAYLOADS,
	type PlayEventInputType,
	updatePlayEvent,
} from "../services/play-event";

const idSchema = z.string().min(1);

const createFields = {
	entryId: idSchema,
	playSessionId: idSchema.optional(),
	occurredAt: instantSchema.optional(),
};

function createVariant<Type extends PlayEventInputType>(eventType: Type) {
	return z.object({
		...createFields,
		eventType: z.literal(eventType),
		payload: PLAY_EVENT_INPUT_PAYLOADS[eventType],
	});
}

export const playEventCreateInputSchema = z.discriminatedUnion("eventType", [
	createVariant("table_change"),
	createVariant("session_pause"),
	createVariant("session_resume"),
	createVariant("chips_add_remove"),
	createVariant("all_in"),
	createVariant("purchase_chips"),
	createVariant("reentry"),
	createVariant("update_stack"),
	createVariant("memo"),
]);

export const playEventRouter = router({
	list: protectedProcedure
		.input(z.object({ entryId: idSchema, playSessionId: idSchema.optional() }))
		.query(
			async ({ ctx, input }) =>
				await listPlayEvents(ctx.db, ctx.session.user.id, input)
		),

	create: protectedProcedure
		.input(playEventCreateInputSchema)
		.mutation(
			async ({ ctx, input }) =>
				await createPlayEvent(ctx.db, ctx.session.user.id, input, new Date())
		),

	update: protectedProcedure
		.input(
			z.object({
				id: idSchema,
				occurredAt: instantSchema.optional(),
				payload: z.record(z.string(), z.unknown()).optional(),
			})
		)
		.mutation(
			async ({ ctx, input }) =>
				await updatePlayEvent(ctx.db, ctx.session.user.id, input, new Date())
		),

	delete: protectedProcedure
		.input(z.object({ id: idSchema }))
		.mutation(async ({ ctx, input }) => {
			await deletePlayEvent(ctx.db, ctx.session.user.id, input.id, new Date());
			return { success: true as const };
		}),
});
