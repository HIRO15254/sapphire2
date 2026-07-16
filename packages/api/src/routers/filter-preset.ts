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

// The discriminated union routes payload validation per-screen (not a
// merged/loose shape): screenKey: "sessions" requires a payload matching
// sessionsFilterPresetPayloadSchema, screenKey: "statistics" requires
// statisticsFilterPresetPayloadSchema. Built from payloadSchemaForScreenKey
// so create() always validates against the exact same schema objects the db
// package (and any later read-side re-parse) uses (api-data-integrity.md).
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

// update() cannot know which payload shape applies until the stored row's
// screenKey is loaded, so the input schema only accepts "a valid payload for
// either screen" — the handler re-validates against the STORED screenKey via
// payloadSchemaForScreenKey below, never the caller's assumption.
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
	const existing = await db
		.select()
		.from(filterPreset)
		.where(
			and(
				eq(filterPreset.userId, userId),
				eq(filterPreset.screenKey, screenKey)
			)
		);
	// Re-check userId/screenKey membership in JS too, not just via the SQL
	// WHERE above — the collision check must never be trickable by a row
	// outside this exact (userId, screenKey) scope leaking through.
	const collides = existing.some(
		(row) =>
			row.userId === userId &&
			row.screenKey === screenKey &&
			row.id !== excludeId &&
			row.name === name
	);
	if (collides) {
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
				// Backstop against the app-level check above racing a concurrent
				// identical (userId, screenKey, name) insert (TOCTOU), mirroring
				// game-group.ts's create().
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

			// A payload provided on update must be re-validated against the
			// schema matching the STORED row's screenKey, never any assumption
			// the caller's input shape implies — the input schema above only
			// proves the payload is valid for *some* screen.
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
				// Same TOCTOU backstop as create() above, for a concurrent rename.
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
				// Clear every OTHER row for this exact (userId, screenKey) — scoped
				// by BOTH so this can never clear another user's or another
				// screen's default.
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
