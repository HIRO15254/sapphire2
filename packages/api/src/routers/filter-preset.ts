import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import {
	type FilterPresetPayload,
	filterPresetScreenKeySchema,
	payloadSchemaForScreenKey,
	presetNameSchema,
} from "@sapphire2/db/schemas/filter-preset";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { runBatch } from "../lib/batch";
import { isFilterPresetNameConflictError } from "../lib/db-errors";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const NAME_CONFLICT_MESSAGE = "You already have a filter preset with this name";
const FORBIDDEN_MESSAGE = "You do not own this filter preset";

const createInputSchema = z.discriminatedUnion("screenKey", [
	z.object({
		screenKey: z.literal("sessions"),
		name: presetNameSchema,
		payload: payloadSchemaForScreenKey("sessions"),
	}),
	z.object({
		screenKey: z.literal("statistics"),
		name: presetNameSchema,
		payload: payloadSchemaForScreenKey("statistics"),
	}),
]);

const updatePayloadSchema = z.union([
	payloadSchemaForScreenKey("sessions"),
	payloadSchemaForScreenKey("statistics"),
]);

function payloadSchemaForStoredScreenKey(screenKey: string) {
	return screenKey === "sessions"
		? payloadSchemaForScreenKey("sessions")
		: payloadSchemaForScreenKey("statistics");
}

async function assertNameAvailable(
	db: Db,
	userId: string,
	screenKey: string,
	name: string,
	excludeId?: string
): Promise<void> {
	const conflicting = await db
		.select({ id: filterPreset.id })
		.from(filterPreset)
		.where(
			and(
				eq(filterPreset.userId, userId),
				eq(filterPreset.screenKey, screenKey),
				eq(filterPreset.name, name),
				excludeId === undefined ? undefined : ne(filterPreset.id, excludeId)
			)
		)
		.limit(1);
	if (conflicting.length > 0) {
		throw new TRPCError({ code: "CONFLICT", message: NAME_CONFLICT_MESSAGE });
	}
}

export const filterPresetRouter = router({
	list: protectedProcedure
		.input(z.object({ screenKey: filterPresetScreenKeySchema }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			return await ctx.db
				.select()
				.from(filterPreset)
				.where(
					and(
						eq(filterPreset.userId, userId),
						eq(filterPreset.screenKey, input.screenKey)
					)
				)
				.orderBy(desc(filterPreset.isDefault), asc(filterPreset.createdAt));
		}),

	create: protectedProcedure
		.input(createInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			await assertNameAvailable(ctx.db, userId, input.screenKey, input.name);

			const id = crypto.randomUUID();
			try {
				await ctx.db.insert(filterPreset).values({
					id,
					userId,
					screenKey: input.screenKey,
					name: input.name,
					payload: input.payload as FilterPresetPayload,
					isDefault: false,
					updatedAt: new Date(),
				});
			} catch (error) {
				if (isFilterPresetNameConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: NAME_CONFLICT_MESSAGE,
					});
				}
				throw error;
			}

			const [created] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: presetNameSchema.optional(),
				payload: updatePayloadSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			if (!found || found.userId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
			}

			let payload: FilterPresetPayload | undefined;
			if (input.payload !== undefined) {
				const schema = payloadSchemaForStoredScreenKey(found.screenKey);
				const parsed = schema.safeParse(input.payload);
				if (!parsed.success) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Payload does not match this preset's screen",
					});
				}
				payload = parsed.data as FilterPresetPayload;
			}

			if (input.name !== undefined && input.name !== found.name) {
				await assertNameAvailable(
					ctx.db,
					userId,
					found.screenKey,
					input.name,
					input.id
				);
			}

			try {
				await ctx.db
					.update(filterPreset)
					.set({
						...(input.name === undefined ? {} : { name: input.name }),
						...(payload === undefined ? {} : { payload }),
						updatedAt: new Date(),
					})
					.where(eq(filterPreset.id, input.id));
			} catch (error) {
				if (isFilterPresetNameConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: NAME_CONFLICT_MESSAGE,
					});
				}
				throw error;
			}

			const [updated] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			if (!found || found.userId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
			}
			await ctx.db.delete(filterPreset).where(eq(filterPreset.id, input.id));
			return { success: true };
		}),

	setDefault: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			if (!found || found.userId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
			}

			if (found.isDefault) {
				return found;
			}

			await runBatch(ctx.db, [
				ctx.db
					.update(filterPreset)
					.set({ isDefault: false, updatedAt: new Date() })
					.where(
						and(
							eq(filterPreset.userId, userId),
							eq(filterPreset.screenKey, found.screenKey),
							ne(filterPreset.id, input.id)
						)
					),
				ctx.db
					.update(filterPreset)
					.set({ isDefault: true, updatedAt: new Date() })
					.where(eq(filterPreset.id, input.id)),
			]);

			const [updated] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			return updated;
		}),

	clearDefault: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			if (!found || found.userId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
			}

			if (!found.isDefault) {
				return found;
			}

			await ctx.db
				.update(filterPreset)
				.set({ isDefault: false, updatedAt: new Date() })
				.where(eq(filterPreset.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(filterPreset)
				.where(eq(filterPreset.id, input.id));
			return updated;
		}),
});
