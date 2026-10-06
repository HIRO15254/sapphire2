import { room } from "@sapphire2/db/schema/room";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { validateEntityOwnership } from "./session";

function coordinatesPaired(value: {
	latitude?: number | null;
	longitude?: number | null;
}): boolean {
	return (
		(value.latitude === undefined) === (value.longitude === undefined) &&
		(value.latitude === null) === (value.longitude === null)
	);
}

const COORDINATES_PAIRED_ISSUE = {
	message: "latitude and longitude must be set or cleared together",
	path: ["longitude"],
};

export const roomIdInputSchema = z.object({ id: z.string() });

export const roomListInputSchema = z
	.object({ includeArchived: z.boolean().optional() })
	.optional();

export const roomCreateInputSchema = z
	.object({
		name: z.string().min(1),
		memo: z.string().optional(),
		latitude: z.number().min(-90).max(90).nullable().optional(),
		longitude: z.number().min(-180).max(180).nullable().optional(),
	})
	.refine(coordinatesPaired, COORDINATES_PAIRED_ISSUE);

export const roomUpdateInputSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1).optional(),
		memo: z.string().nullable().optional(),
		latitude: z.number().min(-90).max(90).nullable().optional(),
		longitude: z.number().min(-180).max(180).nullable().optional(),
	})
	.refine(coordinatesPaired, COORDINATES_PAIRED_ISSUE);

export const roomRouter = router({
	list: protectedProcedure
		.input(roomListInputSchema)
		.query(({ ctx, input }) => {
			const userId = ctx.session.user.id;
			return ctx.db
				.select({
					id: room.id,
					userId: room.userId,
					name: room.name,
					memo: room.memo,
					isFavorite: room.isFavorite,
					createdAt: room.createdAt,
					updatedAt: room.updatedAt,
					latitude: room.latitude,
					longitude: room.longitude,
					archivedAt: room.archivedAt,
					ringGameCount: sql<number>`(SELECT COUNT(*) FROM ring_game WHERE ring_game.room_id = room.id AND ring_game.archived_at IS NULL)`,
					tournamentCount: sql<number>`(SELECT COUNT(*) FROM tournament WHERE tournament.room_id = room.id AND tournament.archived_at IS NULL)`,
				})
				.from(room)
				.where(
					and(
						eq(room.userId, userId),
						input?.includeArchived
							? isNotNull(room.archivedAt)
							: isNull(room.archivedAt)
					)
				)
				.orderBy(desc(room.isFavorite), asc(room.createdAt));
		}),

	getById: protectedProcedure
		.input(roomIdInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}

			return found;
		}),

	create: protectedProcedure
		.input(roomCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await ctx.db.insert(room).values({
				id,
				userId,
				name: input.name,
				memo: input.memo ?? null,
				latitude: input.latitude ?? null,
				longitude: input.longitude ?? null,
				updatedAt: new Date(),
			});
			const [created] = await ctx.db.select().from(room).where(eq(room.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(roomUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}

			await ctx.db
				.update(room)
				.set({
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.memo === undefined ? {} : { memo: input.memo }),
					...(input.latitude === undefined ? {} : { latitude: input.latitude }),
					...(input.longitude === undefined
						? {}
						: { longitude: input.longitude }),
					updatedAt: new Date(),
				})
				.where(eq(room.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));
			return updated;
		}),

	archive: protectedProcedure
		.input(roomIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "room", input.id, userId);
			const now = new Date();
			const [updated] = await ctx.db
				.update(room)
				.set({ archivedAt: now, updatedAt: now })
				.where(and(eq(room.id, input.id), eq(room.userId, userId)))
				.returning();
			return updated;
		}),

	restore: protectedProcedure
		.input(roomIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "room", input.id, userId);
			const [updated] = await ctx.db
				.update(room)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(and(eq(room.id, input.id), eq(room.userId, userId)))
				.returning();
			return updated;
		}),

	delete: protectedProcedure
		.input(roomIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}

			const deleted = await ctx.db
				.delete(room)
				.where(
					and(
						eq(room.id, input.id),
						eq(room.userId, userId),
						sql`NOT EXISTS (SELECT 1 FROM game_session WHERE game_session.room_id = room.id)`,
						sql`NOT EXISTS (SELECT 1 FROM ring_game WHERE ring_game.room_id = room.id)`,
						sql`NOT EXISTS (SELECT 1 FROM tournament WHERE tournament.room_id = room.id)`
					)
				)
				.returning({ id: room.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This room is referenced by sessions or games. Archive the room instead of deleting it.",
				});
			}
			return { success: true };
		}),

	toggleFavorite: protectedProcedure
		.input(roomIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}

			await ctx.db
				.update(room)
				.set({ isFavorite: !found.isFavorite, updatedAt: new Date() })
				.where(eq(room.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));
			return updated;
		}),
});
