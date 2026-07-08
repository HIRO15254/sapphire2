import { room } from "@sapphire2/db/schema/room";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

// Coordinates move as a pair: latitude and longitude must both be omitted
// (leave unchanged), both `null` (cleared) or both numbers (set). Mirrors the
// web form's `.refine`, so a direct tRPC call can't persist a half-set location.
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

export const roomRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const userId = ctx.session.user.id;
		// Active (non-archived) game counts via correlated subqueries so the list
		// card can show them without an N+1 query per room. The column refs are
		// written as literal qualified names — interpolating Drizzle column
		// objects into a raw `sql` subquery renders them *unqualified*
		// (`room_id`/`id`), which inside the child-table FROM resolves to that
		// table's own columns and silently yields 0.
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
				ringGameCount: sql<number>`(SELECT COUNT(*) FROM ring_game WHERE ring_game.room_id = room.id AND ring_game.archived_at IS NULL)`,
				tournamentCount: sql<number>`(SELECT COUNT(*) FROM tournament WHERE tournament.room_id = room.id AND tournament.archived_at IS NULL)`,
			})
			.from(room)
			.where(eq(room.userId, userId))
			.orderBy(desc(room.isFavorite), asc(room.createdAt));
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}

			return found;
		}),

	create: protectedProcedure
		.input(
			z
				.object({
					name: z.string().min(1),
					memo: z.string().optional(),
					latitude: z.number().min(-90).max(90).nullable().optional(),
					longitude: z.number().min(-180).max(180).nullable().optional(),
				})
				.refine(coordinatesPaired, COORDINATES_PAIRED_ISSUE)
		)
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
		.input(
			z
				.object({
					id: z.string(),
					name: z.string().min(1).optional(),
					// Nullable so an explicit `null` clears the memo. `undefined`
					// (key omitted) still means "leave unchanged".
					memo: z.string().nullable().optional(),
					// Geographic coordinates. Nullable so an explicit `null` clears the
					// location; `undefined` leaves it unchanged (same pattern as memo).
					latitude: z.number().min(-90).max(90).nullable().optional(),
					longitude: z.number().min(-180).max(180).nullable().optional(),
				})
				.refine(coordinatesPaired, COORDINATES_PAIRED_ISSUE)
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
			}

			if (found.userId !== userId) {
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

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}

			await ctx.db.delete(room).where(eq(room.id, input.id));
			return { success: true };
		}),

	toggleFavorite: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(room)
				.where(eq(room.id, input.id));

			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
			}

			if (found.userId !== userId) {
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
